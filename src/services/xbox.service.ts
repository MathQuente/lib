import { Prisma } from '@prisma/client'
import { ClientError } from '../errors/client-error'
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
  meetsCompletionRatio
} from '../utils/completion-heuristics'
import {
  xboxImportQueue,
  xboxImportJobId,
  XboxImportJobResult
} from '../queues/xbox-import.queue'
import { enqueueUniqueImport, getImportJobStatus } from '../queues/import-job'
import { UserGamePlatformService } from './user-game-platform.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'

const PLAYED_STATUS_ID = 1
const PLAYING_STATUS_ID = 3
const BACKLOG_STATUS_ID = 4
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
  achievements: { description: string; unlockedAt: Date }[]
): Date | undefined {
  if (achievements.length === 0) return undefined
  const times = (list: typeof achievements) =>
    list.map(a => a.unlockedAt.getTime())

  const story = achievements.filter(a =>
    COMPLETION_KEYWORD_PATTERN.test(a.description)
  )
  return story.length > 0
    ? new Date(Math.min(...times(story)))
    : new Date(Math.max(...times(achievements)))
}

const BASE_GAME_GAMERSCORE = 1000

function looksFinished(title: XboxTitle, igdbGame: IGDBGame): boolean {
  if (title.achievementProgress >= 100) return true
  if (!canInferCompletion(igdbGame)) return false

  const earned = title.achievementsEarned
  if (earned <= 0) return false

  if (title.achievementsTotal > 0) {
    return meetsCompletionRatio(earned, title.achievementsTotal)
  }

  if (title.gamerscoreEarned <= 0 || title.gamerscoreTotal <= 0) return false
  const share = Math.min(
    1,
    title.gamerscoreEarned /
      Math.min(title.gamerscoreTotal, BASE_GAME_GAMERSCORE)
  )
  const estimatedTotal = Math.round(earned / share)
  return meetsCompletionRatio(share * estimatedTotal, estimatedTotal)
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
    private nameSearchIntervalMs = NAME_SEARCH_INTERVAL_MS
  ) {}

  private lastNameSearchAt = 0

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async connectXbox(userId: string, verifiedProfile: XboxProfile) {
    await this.requireUser(userId)

    try {
      await this.userRepository.setXboxAccount(userId, verifiedProfile)
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

  async disconnectXbox(userId: string) {
    await this.requireUser(userId)
    await this.userRepository.setXboxAccount(userId, null)
  }

  async enqueueImport(userId: string) {
    const user = await this.requireUser(userId)
    if (!user.xboxXuid) {
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
    const user = await this.requireUser(userId)
    if (!user.xboxXuid) {
      throw new ClientError('Conecte seu perfil do Xbox primeiro.', 400)
    }

    let titles: XboxTitle[]
    try {
      titles = await this.xboxApiService.getTitleHistory(user.xboxXuid)
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

    const igdbByTitleId = await this.matchTitles(titles)

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
          lastPlayedAt: title.lastPlayedAt,
          mostCompleted: title
        })
        continue
      }

      skipped++
      existing.titleIds.push(title.titleId)
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
      user.xboxXuid,
      toImport.flatMap(game => game.titleIds)
    )
    const finishedTitles = toImport
      .filter(game => looksFinished(game.mostCompleted, game.igdbGame))
      .map(game => game.mostCompleted)
    const completedAtByTitleId = await this.loadCompletionDates(
      user.xboxXuid,
      finishedTitles
    )
    const finishedTitleIds = new Set(finishedTitles.map(t => t.titleId))

    const total = toImport.length
    let imported = 0
    let updated = 0
    const now = Date.now()

    for (const { igdbGame, titleIds, lastPlayedAt, mostCompleted } of toImport) {
      const minutes = titleIds.flatMap(id => minutesByTitleId.get(id) ?? [])
      const isFinished = finishedTitleIds.has(mostCompleted.titleId)
      const isRecent =
        !!lastPlayedAt &&
        now - lastPlayedAt.getTime() <= RECENT_PLAY_THRESHOLD_MS

      const statusId = isFinished
        ? PLAYED_STATUS_ID
        : isRecent
          ? PLAYING_STATUS_ID
          : BACKLOG_STATUS_ID

      await this.gameCacheService.cacheMany([igdbGame])
      const outcome = await this.userGamePlatformService.importPlatform(
        userId,
        igdbGame.id,
        'XBOX',
        {
          statusId,
          hoursPlayed:
            minutes.length > 0
              ? Math.round((minutes.reduce((a, b) => a + b, 0) / 60) * 100) / 100
              : undefined,
          finished: isFinished,
          completedAt: isFinished
            ? (completedAtByTitleId.get(mostCompleted.titleId) ??
              mostCompleted.lastPlayedAt ??
              undefined)
            : undefined
        }
      )

      if (outcome === 'imported') imported++
      else updated++
      onProgress?.(Math.round(((imported + updated) / total) * 100))
    }

    onProgress?.(100)

    return { library: { imported, updated, skipped, notFound } }
  }

  private async loadCompletionDates(xuid: string, titles: XboxTitle[]) {
    const dates = new Map<string, Date>()

    for (const title of titles.slice(0, MAX_COMPLETION_DATE_LOOKUPS)) {
      try {
        const achievements = await this.xboxApiService.getUnlockedAchievements(
          xuid,
          title.titleId
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

  private async loadMinutesPlayed(xuid: string, titleIds: string[]) {
    if (titleIds.length === 0) return new Map<string, number>()
    try {
      return await this.xboxApiService.getMinutesPlayed(xuid, titleIds)
    } catch (err) {
      if (!(err instanceof XboxApiError)) throw err
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
