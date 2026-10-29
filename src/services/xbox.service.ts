import { Prisma } from '@prisma/client'
import { ClientError, XboxAccountLimitError } from '../errors/client-error'
import { IGDBRequestError } from '../errors/igdb-request-error'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { IGDBService } from './igdb.service'
import {
  XboxApiError,
  XboxApiService,
  XboxProfile,
  XboxTitle
} from './xbox-api.service'
import { IGDBGame } from '../types/igdb'
import { normalizeGameName } from '../utils/normalize-game-name'
import {
  canInferCompletion,
  COMPLETION_KEYWORD_PATTERN,
  hasSinglePlayerMode,
  hasMultiplayerMode,
  meetsCompletionRatio,
  MIN_ACHIEVEMENTS_FOR_SIGNAL
} from '../utils/completion-heuristics'
import {
  xboxImportQueue,
  xboxImportJobId,
  XboxAccountImportResult,
  XboxImportJobResult
} from '../queues/xbox-import.queue'
import {
  enqueueUniqueImport,
  getImportJobStatus,
  ImportSectionResult
} from '../queues/import-job'
import type { CompletionSuggestionRecorder } from './completion-suggestion.service'
import { UserGamePlatformService } from './user-game-platform.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { consoleFromXboxDevices } from '../utils/console-inference'
import {
  PLAYED_STATUS_ID,
  PLAYING_STATUS_ID,
  BACKLOG_STATUS_ID
} from '../utils/library-status'

export const MAX_XBOX_ACCOUNTS = 2
const HOURS_INCOMPLETE_WARNING =
  'Não foi possível trazer as horas de alguns jogos. Importe de novo mais tarde.'

const GENERIC_ACCOUNT_ERROR =
  'Erro ao importar esta conta do Xbox. Tente novamente mais tarde.'
const RECENT_PLAY_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000
const NAME_SEARCH_INTERVAL_MS = 275
const CONSOLE_SUFFIX = /\s+(?:for\s+)?xbox\s+(?:series\s+x\|s|one|360)$/i
const PUBLISHER_PREFIX = /^ea\s+sports\s+/i
const ABBREVIATIONS: Record<string, string> = {
  COD: 'Call of Duty',
  RE: 'Resident Evil',
  OF: 'Operation Flashpoint'
}

const UNAVAILABLE_MESSAGE =
  'Não foi possível consultar a Xbox Live. Tente novamente mais tarde.'
const RATE_LIMITED_MESSAGE =
  'A integração com o Xbox atingiu o limite de consultas. Tente novamente mais tarde.'

interface MergedXboxGame {
  igdbGame: IGDBGame
  titleIds: string[]
  devices: string[]
  lastPlayedAt: Date | null
  mostCompleted: XboxTitle
}

function looseName(name: string) {
  return name
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function nameVariants(titleName: string): string[] {
  const cleaned = titleName
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(CONSOLE_SUFFIX, '')
  const expanded = cleaned.replace(
    /^[A-Z]+\b/,
    token => ABBREVIATIONS[token] ?? token
  )
  const variants = [
    cleaned,
    expanded,
    cleaned.replace(PUBLISHER_PREFIX, '')
  ]
  const original = looseName(titleName)
  return [...new Set(variants)].filter(v => v && looseName(v) !== original)
}

export function pickSubtitleMatch(
  titleName: string,
  candidates: IGDBGame[]
): IGDBGame | null {
  const wanted = normalizeGameName(titleName)
  if (!wanted) return null

  const matches = candidates.filter(game => {
    const separator = game.name.indexOf(':')
    return (
      separator > 0 &&
      game.parent_game == null &&
      !game.name.includes(' - ') &&
      normalizeGameName(game.name.slice(0, separator)) === wanted
    )
  })

  return matches.length === 1 ? matches[0] : null
}

export function pickNameMatch(
  titleName: string,
  candidates: IGDBGame[]
): IGDBGame | null {
  const wanted = normalizeGameName(titleName)
  if (!wanted) return null
  const loose = looseName(titleName)

  const ranked = candidates.flatMap(game => {
    const rank =
      looseName(game.name) === loose
        ? 0
        : normalizeGameName(game.name) === wanted
          ? 1
          : game.alternative_names?.some(
                alt => normalizeGameName(alt.name) === wanted
              )
            ? 2
            : null
    return rank === null ? [] : [{ game, rank }]
  })

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(a.game.parent_game != null) - Number(b.game.parent_game != null) ||
      Number(!a.game.cover) - Number(!b.game.cover) ||
      (b.game.total_rating_count ?? 0) - (a.game.total_rating_count ?? 0) ||
      (a.game.first_release_date ?? Infinity) -
        (b.game.first_release_date ?? Infinity) ||
      a.game.id - b.game.id
  )

  return ranked[0]?.game ?? null
}

const MAX_COMPLETION_DATE_LOOKUPS = 20
const MAX_KEYWORD_LOOKUPS = 40

const IGDB_PLATFORM_BY_DEVICE: Record<string, string> = {
  Xbox: 'Xbox',
  Xbox360: 'Xbox 360',
  XboxOne: 'Xbox One',
  XboxSeries: 'Xbox Series X|S',
  PC: 'PC (Microsoft Windows)'
}

export function runsOnTitleDevices(game: IGDBGame, devices: string[]): boolean {
  const platforms = game.platforms?.map(p => p.name)
  if (!platforms || platforms.length === 0) return true

  const consoles = devices.filter(d => d !== 'PC')
  const wanted = (consoles.length > 0 ? consoles : devices).flatMap(
    d => IGDB_PLATFORM_BY_DEVICE[d] ?? []
  )
  if (wanted.length === 0) return true

  return wanted.some(platform => platforms.includes(platform))
}

function completionDateFrom(
  achievements: { description: string; unlockedAt: Date | null }[]
): Date | undefined {
  const dated = achievements.flatMap(a =>
    a.unlockedAt ? [{ description: a.description, unlockedAt: a.unlockedAt }] : []
  )
  if (dated.length === 0) return undefined
  const times = (list: typeof dated) => list.map(a => a.unlockedAt.getTime())

  const story = dated.filter(a => COMPLETION_KEYWORD_PATTERN.test(a.description))
  return story.length > 0
    ? new Date(Math.min(...times(story)))
    : new Date(Math.max(...times(dated)))
}

function parentIdOf(game: IGDBGame): number | undefined {
  const parent = game.parent_game
  if (parent == null) return undefined
  return typeof parent === 'object' ? parent.id : parent
}

export function collapsePortsIntoParent(
  igdbByTitleId: Map<string, IGDBGame>
): Map<string, IGDBGame> {
  const matchedById = new Map<number, IGDBGame>()
  for (const game of igdbByTitleId.values()) matchedById.set(game.id, game)

  const collapsed = new Map<string, IGDBGame>()
  for (const [titleId, game] of igdbByTitleId) {
    const parentId = parentIdOf(game)
    const parent = parentId !== undefined ? matchedById.get(parentId) : undefined
    const isPort =
      !!parent &&
      normalizeGameName(parent.name) === normalizeGameName(game.name)
    collapsed.set(titleId, isPort ? parent : game)
  }
  return collapsed
}

export function findBasesOfFinishedExpansions(
  games: MergedXboxGame[],
  finishedTitleIds: Set<string>,
  gameTypes: Map<number, number>
): string[] {
  const byIgdbId = new Map(games.map(game => [game.igdbGame.id, game]))
  const bases: string[] = []

  for (const { igdbGame, mostCompleted } of games) {
    if (!finishedTitleIds.has(mostCompleted.titleId)) continue
    if (gameTypes.get(igdbGame.id) !== IGDBService.EXPANSION_GAME_TYPE) continue

    const parentId = parentIdOf(igdbGame)
    const base = parentId !== undefined ? byIgdbId.get(parentId) : undefined
    if (!base || finishedTitleIds.has(base.mostCompleted.titleId)) continue
    if (base.mostCompleted.achievementsEarned <= 0) continue

    bases.push(base.mostCompleted.titleId)
  }

  return bases
}

const MIN_PROGRESS_WITHOUT_TOTAL = 70
const BASE_GAME_GAMERSCORE = 1000
const MAX_GAMERSCORE_FOR_ESTIMATE = 1500

function isConfirmedByProgress(title: XboxTitle) {
  return title.achievementProgress >= 100
}

type FinishVerdict = 'finished' | 'suggest' | 'no'

function finishVerdict(title: XboxTitle, igdbGame: IGDBGame): FinishVerdict {
  if (isConfirmedByProgress(title)) return 'finished'
  if (!canInferCompletion(igdbGame)) return 'no'
  if (title.achievementsEarned <= 0) return 'no'

  if (title.achievementsTotal > 0) {
    return meetsCompletionRatio(title.achievementsEarned, title.achievementsTotal)
      ? 'finished'
      : 'no'
  }

  if (
    title.gamerscoreEarned > 0 &&
    title.gamerscoreTotal > 0 &&
    title.gamerscoreTotal <= MAX_GAMERSCORE_FOR_ESTIMATE
  ) {
    const share = Math.min(
      1,
      title.gamerscoreEarned /
        Math.min(title.gamerscoreTotal, BASE_GAME_GAMERSCORE)
    )
    const estimatedTotal = Math.round(title.achievementsEarned / share)
    return meetsCompletionRatio(share * estimatedTotal, estimatedTotal)
      ? 'finished'
      : 'no'
  }

  if (title.achievementProgress < MIN_PROGRESS_WITHOUT_TOTAL) return 'no'
  return hasMultiplayerMode(igdbGame) ? 'suggest' : 'finished'
}

export class XboxService {
  constructor(
    private userRepository: UserRepository,
    private gameCacheService: GameCacheService,
    private xboxApiService: XboxApiService,
    private userGamePlatformService: UserGamePlatformService = new UserGamePlatformService(
      new UserGamePlatformRepository(),
      userRepository
    ),
    private nameSearchIntervalMs = NAME_SEARCH_INTERVAL_MS,
    private completionSuggestionRecorder?: CompletionSuggestionRecorder
  ) {}

  private lastNameSearchAt = 0

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async connectXbox(userId: string, verifiedProfile: XboxProfile) {
    await this.requireUser(userId)

    const existing = await this.userRepository.findXboxAccountByXuid(
      verifiedProfile.xuid
    )
    if (existing) {
      if (existing.userId !== userId) {
        throw new ClientError(
          'Este perfil do Xbox já está vinculado a outra conta.',
          409
        )
      }
      await this.userRepository.updateXboxGamertag(
        existing.id,
        verifiedProfile.gamertag
      )
      return { xboxGamertag: verifiedProfile.gamertag }
    }

    const accounts = await this.userRepository.listXboxAccounts(userId)
    if (accounts.length >= MAX_XBOX_ACCOUNTS) {
      throw new XboxAccountLimitError(MAX_XBOX_ACCOUNTS)
    }

    try {
      const created = await this.userRepository.addXboxAccount(
        userId,
        verifiedProfile,
        MAX_XBOX_ACCOUNTS
      )
      if (!created) throw new XboxAccountLimitError(MAX_XBOX_ACCOUNTS)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ClientError(
          'Este perfil do Xbox já está vinculado a outra conta.',
          409
        )
      }
      throw err
    }

    return { xboxGamertag: verifiedProfile.gamertag }
  }

  async disconnectXbox(userId: string, accountId: string) {
    await this.requireUser(userId)
    await this.userGamePlatformService.removeXboxAccount(userId, accountId)
  }

  async enqueueImport(userId: string) {
    await this.requireUser(userId)
    const accounts = await this.userRepository.listXboxAccounts(userId)
    if (accounts.length === 0) {
      throw new ClientError('Conecte seu perfil do Xbox primeiro.', 400)
    }

    return enqueueUniqueImport(
      xboxImportQueue,
      xboxImportJobId(userId),
      { userId },
      'Xbox'
    )
  }

  async getImportStatus(userId: string) {
    return getImportJobStatus<XboxImportJobResult>(
      xboxImportQueue,
      xboxImportJobId(userId)
    )
  }

  async runImport(
    userId: string,
    onProgress?: (percent: number) => void
  ): Promise<XboxImportJobResult> {
    await this.requireUser(userId)
    const accounts = await this.userRepository.listXboxAccounts(userId)
    if (accounts.length === 0) {
      throw new ClientError('Conecte seu perfil do Xbox primeiro.', 400)
    }

    const results: XboxAccountImportResult[] = []
    const failures: unknown[] = []

    for (const [index, account] of accounts.entries()) {
      const report = (percent: number) =>
        onProgress?.(Math.round(((index + percent / 100) / accounts.length) * 100))
      try {
        let hoursIncomplete = false
        const library = await this.importAccount(userId, account, report, () => {
          hoursIncomplete = true
        })
        results.push({
          gamertag: account.gamertag,
          library,
          ...(hoursIncomplete ? { warning: HOURS_INCOMPLETE_WARNING } : {})
        })
      } catch (err) {
        failures.push(err)
        console.error('[Xbox] account import failed', {
          gamertag: account.gamertag,
          error: err instanceof Error ? err.message : 'unknown error'
        })
        results.push({
          gamertag: account.gamertag,
          error:
            err instanceof ClientError ? err.message : GENERIC_ACCOUNT_ERROR
        })
      }
    }

    if (failures.length === accounts.length) throw failures[0]

    onProgress?.(100)

    const library: ImportSectionResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      notFound: []
    }
    let suggestions = 0
    for (const { library: accountLibrary } of results) {
      if (!accountLibrary) continue
      library.imported += accountLibrary.imported
      library.updated += accountLibrary.updated
      library.skipped += accountLibrary.skipped
      library.notFound.push(...accountLibrary.notFound)
      suggestions += accountLibrary.suggestions ?? 0
    }
    if (suggestions > 0) library.suggestions = suggestions

    return { library, accounts: results }
  }

  private async importAccount(
    userId: string,
    account: { id: string; xuid: string },
    onProgress: (percent: number) => void,
    onHoursIncomplete: () => void
  ): Promise<ImportSectionResult> {
    let titles: XboxTitle[]
    try {
      titles = await this.xboxApiService.getTitleHistory(account.xuid)
    } catch (err) {
      if (err instanceof XboxApiError) {
        console.error('[Xbox] title history failed', { error: err.message })
        if (err.status === 429) throw new ClientError(RATE_LIMITED_MESSAGE, 503)
        if (err.status === undefined || err.status >= 500) {
          throw new ClientError(UNAVAILABLE_MESSAGE, 502)
        }
        throw new ClientError(
          'Não foi possível acessar seus jogos do Xbox — verifique se o histórico de jogos do seu perfil está visível para todos e tente novamente.',
          400
        )
      }
      throw err
    }

    const igdbByTitleId = collapsePortsIntoParent(
      await this.matchTitles(titles)
    )

    const notFound: string[] = []
    let skipped = 0
    const byIgdbId = new Map<number, MergedXboxGame>()

    for (const title of titles) {
      const igdbGame = igdbByTitleId.get(title.titleId)
      if (!igdbGame) {
        notFound.push(title.name)
        continue
      }

      const existing = byIgdbId.get(igdbGame.id)
      if (!existing) {
        byIgdbId.set(igdbGame.id, {
          igdbGame,
          titleIds: [title.titleId],
          devices: [...title.devices],
          lastPlayedAt: title.lastPlayedAt,
          mostCompleted: title
        })
        continue
      }

      skipped++
      existing.titleIds.push(title.titleId)
      existing.devices = [...new Set([...existing.devices, ...title.devices])]
      if (
        title.lastPlayedAt &&
        (!existing.lastPlayedAt || title.lastPlayedAt > existing.lastPlayedAt)
      ) {
        existing.lastPlayedAt = title.lastPlayedAt
      }
      if (
        title.achievementProgress > existing.mostCompleted.achievementProgress
      ) {
        existing.mostCompleted = title
      }
    }

    const toImport = [...byIgdbId.values()]
    const minutesByTitleId = await this.loadMinutesPlayed(
      account.xuid,
      toImport.flatMap(game => game.titleIds),
      onHoursIncomplete
    )
    const verdicts = new Map(
      toImport.map(game => [
        game.mostCompleted.titleId,
        finishVerdict(game.mostCompleted, game.igdbGame)
      ])
    )
    const finishedTitles = toImport
      .filter(game => verdicts.get(game.mostCompleted.titleId) === 'finished')
      .map(game => game.mostCompleted)
    const completedAtByTitleId = await this.loadCompletionDates(
      account.xuid,
      finishedTitles
    )
    const finishedTitleIds = new Set(finishedTitles.map(t => t.titleId))

    const storyFinished = await this.findFinishedByStoryAchievement(
      account.xuid,
      toImport.filter(game => !finishedTitleIds.has(game.mostCompleted.titleId))
    )
    const strongTitleIds = new Set(storyFinished.keys())
    for (const [titleId, completedAt] of storyFinished) {
      finishedTitleIds.add(titleId)
      if (completedAt) completedAtByTitleId.set(titleId, completedAt)
    }

    for (const titleId of await this.findExpansionBases(
      toImport,
      finishedTitleIds
    )) {
      finishedTitleIds.add(titleId)
    }

    const total = toImport.length
    let imported = 0
    let updated = 0
    let suggestions = 0
    let processed = 0
    const now = Date.now()

    for (const {
      igdbGame,
      titleIds,
      devices,
      lastPlayedAt,
      mostCompleted
    } of toImport) {
      const minutes = titleIds.flatMap(id => minutesByTitleId.get(id) ?? [])
      const hoursPlayed =
        minutes.length > 0
          ? Math.round((minutes.reduce((a, b) => a + b, 0) / 60) * 100) / 100
          : undefined
      const isFinished = finishedTitleIds.has(mostCompleted.titleId)
      const isRecent =
        !!lastPlayedAt &&
        now - lastPlayedAt.getTime() <= RECENT_PLAY_THRESHOLD_MS

      const activityStatusId = isRecent ? PLAYING_STATUS_ID : BACKLOG_STATUS_ID
      const statusId = isFinished ? PLAYED_STATUS_ID : activityStatusId
      const confirmedFinished = isConfirmedByProgress(mostCompleted)

      await this.gameCacheService.cacheMany([igdbGame])
      const outcome = await this.userGamePlatformService.importPlatform(
        userId,
        igdbGame.id,
        'XBOX',
        {
          statusId,
          activityStatusId,
          hoursPlayed,
          finished: isFinished,
          confirmedFinished,
          strongFinished: strongTitleIds.has(mostCompleted.titleId),
          completedAt: isFinished
            ? (completedAtByTitleId.get(mostCompleted.titleId) ??
              mostCompleted.lastPlayedAt ??
              undefined)
            : undefined,
          endless: IGDBService.suggestsEndlessForGame(igdbGame)
        },
        consoleFromXboxDevices(devices),
        account.id
      )

      if (outcome === 'imported') imported++
      else if (outcome === 'skipped') skipped++
      else updated++

      const wantsSuggestion =
        !isFinished &&
        verdicts.get(mostCompleted.titleId) === 'suggest' &&
        outcome !== 'skipped' &&
        this.completionSuggestionRecorder
      if (wantsSuggestion) {
        try {
          const recorded = await this.completionSuggestionRecorder!.record(
            userId,
            igdbGame.id,
            'XBOX',
            {
              hoursPlayed: hoursPlayed ?? 0,
              normallyHours: null,
              achieved: mostCompleted.achievementsEarned,
              total:
                mostCompleted.achievementsTotal > 0
                  ? mostCompleted.achievementsTotal
                  : null,
              signals: ['heuristic']
            },
            true
          )
          if (recorded) suggestions++
        } catch (error) {
          console.error('[Xbox] completion suggestion failed', {
            igdbId: igdbGame.id,
            error: error instanceof Error ? error.message : error
          })
        }
      }
      processed++
      onProgress(Math.round((processed / total) * 100))
    }

    onProgress(100)

    return {
      imported,
      updated,
      skipped,
      notFound,
      ...(suggestions > 0 ? { suggestions } : {})
    }
  }

  private async findExpansionBases(
    games: MergedXboxGame[],
    finishedTitleIds: Set<string>
  ) {
    const importedIds = new Set(games.map(game => game.igdbGame.id))
    const childIds = games
      .filter(({ igdbGame, mostCompleted }) => {
        const parentId = parentIdOf(igdbGame)
        return (
          finishedTitleIds.has(mostCompleted.titleId) &&
          parentId !== undefined &&
          importedIds.has(parentId)
        )
      })
      .map(({ igdbGame }) => igdbGame.id)
    if (childIds.length === 0) return []

    try {
      const gameTypes = await IGDBService.getGameTypesByIds(childIds)
      return findBasesOfFinishedExpansions(games, finishedTitleIds, gameTypes)
    } catch (err) {
      if (!(err instanceof IGDBRequestError)) throw err
      console.warn('[Xbox] game type lookup failed, skipping expansion bases')
      return []
    }
  }

  private async findFinishedByStoryAchievement(
    xuid: string,
    games: MergedXboxGame[]
  ) {
    const finished = new Map<string, Date | undefined>()

    const candidates = games
      .filter(
        ({ mostCompleted, igdbGame }) =>
          mostCompleted.achievementsEarned >= MIN_ACHIEVEMENTS_FOR_SIGNAL &&
          hasSinglePlayerMode(igdbGame)
      )
      .map(({ mostCompleted }) => mostCompleted)
      .sort((a, b) => b.achievementsEarned - a.achievementsEarned)
      .slice(0, MAX_KEYWORD_LOOKUPS)

    for (const title of candidates) {
      try {
        const achievements = await this.xboxApiService.getUnlockedAchievements(
          xuid,
          title.titleId,
          title.devices
        )
        const matched = achievements.filter(a =>
          COMPLETION_KEYWORD_PATTERN.test(a.description)
        )
        if (matched.length > 0) {
          finished.set(title.titleId, completionDateFrom(matched))
        }
      } catch (err) {
        if (!(err instanceof XboxApiError)) throw err
        console.warn('[Xbox] story achievement lookup failed, skipping the rest', {
          error: err.message
        })
        break
      }
    }

    return finished
  }

  private async loadCompletionDates(xuid: string, titles: XboxTitle[]) {
    const dates = new Map<string, Date>()

    for (const title of titles.slice(0, MAX_COMPLETION_DATE_LOOKUPS)) {
      try {
        const achievements = await this.xboxApiService.getUnlockedAchievements(
          xuid,
          title.titleId,
          title.devices
        )
        const completedAt = completionDateFrom(achievements)
        if (completedAt) dates.set(title.titleId, completedAt)
      } catch (err) {
        if (!(err instanceof XboxApiError)) throw err
        console.warn(
          '[Xbox] achievement dates lookup failed, using last played dates',
          { error: err.message }
        )
        break
      }
    }

    return dates
  }

  private async loadMinutesPlayed(
    xuid: string,
    titleIds: string[],
    onIncomplete: () => void
  ) {
    if (titleIds.length === 0) return new Map<string, number>()
    try {
      return await this.xboxApiService.getMinutesPlayed(
        xuid,
        titleIds,
        err => {
          onIncomplete()
          console.warn('[Xbox] minutes played batch failed, skipping its hours', {
            error: err.message
          })
        }
      )
    } catch (err) {
      if (!(err instanceof XboxApiError)) throw err
      onIncomplete()
      console.warn('[Xbox] minutes played lookup failed, importing without hours', {
        error: err.message
      })
      return new Map<string, number>()
    }
  }

  private async matchTitles(titles: XboxTitle[]) {
    const result = new Map<string, IGDBGame>()

    const productByPfn = await this.xboxApiService.resolveProductIds(
      titles.flatMap(t => (t.pfn ? [t.pfn] : []))
    )
    const matches = await IGDBService.getGamesByExternalIds(
      [...new Set(productByPfn.values())],
      IGDBService.XBOX_EXTERNAL_GAME_SOURCE
    )
    const productToIgdb = new Map(matches.map(m => [m.uid, m.game]))

    const unmatched: XboxTitle[] = []
    for (const title of titles) {
      const productId = title.pfn ? productByPfn.get(title.pfn) : undefined
      const igdbGame = productId ? productToIgdb.get(productId) : undefined
      if (igdbGame) result.set(title.titleId, igdbGame)
      else if (normalizeGameName(title.name)) unmatched.push(title)
    }

    for (const title of unmatched) {
      const igdbGame = await this.findByName(title.name, title.devices)
      if (igdbGame) result.set(title.titleId, igdbGame)
    }

    return result
  }

  private async findByName(
    name: string,
    devices: string[]
  ): Promise<IGDBGame | null> {
    const search = async (term: string) =>
      (await this.searchByName(term)).filter(game =>
        runsOnTitleDevices(game, devices)
      )

    const candidates = await search(name)
    const exact = pickNameMatch(name, candidates)
    if (exact) return exact

    for (const variant of nameVariants(name)) {
      const match = pickNameMatch(variant, await search(variant))
      if (match) return match
    }

    return pickSubtitleMatch(name, candidates)
  }

  private async searchByName(name: string): Promise<IGDBGame[]> {
    const wait = this.lastNameSearchAt + this.nameSearchIntervalMs - Date.now()
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    this.lastNameSearchAt = Date.now()

    try {
      return await IGDBService.searchGamesByName(
        name,
        IGDBService.XBOX_SEARCH_PLATFORM_IDS
      )
    } catch (err) {
      if (!(err instanceof IGDBRequestError)) throw err
      console.warn('[Xbox] name lookup failed', { name })
      return []
    }
  }
}
