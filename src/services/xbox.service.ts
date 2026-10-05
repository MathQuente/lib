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

  async connectXbox(userId: string, gamertagInput: string) {
    await this.requireUser(userId)

    let profile: XboxProfile | null
    try {
      profile = await this.xboxApiService.findProfile(gamertagInput.trim())
    } catch (err) {
      if (err instanceof XboxApiError) {
        console.error('[Xbox] profile lookup failed', { error: err.message })
        if (err.status === 429) throw new ClientError(RATE_LIMITED_MESSAGE, 503)
        throw new ClientError(UNAVAILABLE_MESSAGE, 502)
      }
      throw err
    }

    if (!profile) {
      throw new ClientError(
        'Não foi possível encontrar um perfil do Xbox com essa gamertag.',
        400
      )
    }

    try {
      await this.userRepository.setXboxAccount(userId, profile)
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

    return { xboxGamertag: profile.gamertag }
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
    const total = toImport.length
    let imported = 0
    let updated = 0
    const now = Date.now()

    for (const { igdbGame, titleIds, lastPlayedAt, mostCompleted } of toImport) {
      const minutes = titleIds.flatMap(id => minutesByTitleId.get(id) ?? [])
      const isFinished = mostCompleted.achievementProgress >= 100
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
            ? (mostCompleted.lastPlayedAt ?? undefined)
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
      const igdbGame = await this.findByName(title.name)
      if (igdbGame) result.set(title.titleId, igdbGame)
    }

    return result
  }

  private async findByName(name: string): Promise<IGDBGame | null> {
    const candidates = await this.searchByName(name)
    const exact = pickNameMatch(name, candidates)
    if (exact) return exact

    for (const variant of nameVariants(name)) {
      const match = pickNameMatch(variant, await this.searchByName(variant))
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
