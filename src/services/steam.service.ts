import { Prisma } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { IGDBService } from './igdb.service'
import { SteamApiService, SteamOwnedGame } from './steam-api.service'
import { IGDBGame } from '../types/igdb'
import {
  steamImportQueue,
  steamImportJobId,
  SteamImportJobResult,
  SteamImportSectionResult
} from '../queues/steam-import.queue'

const PLAYED_STATUS_ID = 1
const PLAYING_STATUS_ID = 3
const BACKLOG_STATUS_ID = 4
const WISHLIST_STATUS_ID = 5
const RECENT_PLAY_THRESHOLD_SECONDS = 14 * 24 * 60 * 60
const IMPORT_COOLDOWN_MS = 60 * 60 * 1000

const MIN_ACHIEVEMENTS_FOR_SIGNAL = 5
const FINISHED_ACHIEVEMENT_RATIO = 0.9
const ACHIEVEMENT_CHECK_CONCURRENCY = 10

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return results
}

export class SteamService {
  constructor(
    private userRepository: UserRepository,
    private gameCacheService: GameCacheService
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('User not found.', 404)
    return user
  }

  private async resolveImportTargets<T extends { appid: number; name: string }>(
    items: T[],
    appIdToIgdb: Map<number, IGDBGame>,
    userId: string
  ): Promise<{
    toImport: { item: T; igdbGame: IGDBGame }[]
    skipped: number
    notFound: string[]
  }> {
    let skipped = 0
    const notFound: string[] = []
    const toImport: { item: T; igdbGame: IGDBGame }[] = []
    const queuedIgdbIds = new Set<number>()

    for (const item of items) {
      const igdbGame = appIdToIgdb.get(item.appid)
      if (!igdbGame) {
        notFound.push(item.name)
        continue
      }

      if (queuedIgdbIds.has(igdbGame.id)) {
        skipped++
        continue
      }

      const existing = await this.userRepository.findUserGame(
        igdbGame.id,
        userId
      )
      if (existing) {
        skipped++
        continue
      }

      queuedIgdbIds.add(igdbGame.id)
      toImport.push({ item, igdbGame })
    }

    return { toImport, skipped, notFound }
  }

  async connectSteam(userId: string, profileInput: string) {
    await this.requireUser(userId)

    const { steamId64, vanity } =
      SteamApiService.parseProfileInput(profileInput)
    const resolvedId =
      steamId64 ??
      (vanity ? await SteamApiService.resolveVanityUrl(vanity) : null)

    if (!resolvedId) {
      throw new ClientError(
        'Could not find a Steam profile for that link or ID.',
        400
      )
    }

    try {
      await this.userRepository.setSteamId(userId, resolvedId)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ClientError(
          'This Steam profile is already linked to another account.',
          409
        )
      }
      throw err
    }

    return { steamId: resolvedId }
  }

  async disconnectSteam(userId: string) {
    await this.requireUser(userId)
    await this.userRepository.setSteamId(userId, null)
  }

  async enqueueImport(userId: string) {
    const user = await this.requireUser(userId)
    if (!user.steamId) {
      throw new ClientError('Connect your Steam profile first.', 400)
    }

    const jobId = steamImportJobId(userId)
    const existing = await steamImportQueue.getJob(jobId)

    if (existing) {
      const state = await existing.getState()
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        throw new ClientError('A Steam import is already running.', 409)
      }
      if (state === 'completed' && existing.finishedOn) {
        const remainingMs =
          existing.finishedOn + IMPORT_COOLDOWN_MS - Date.now()
        if (remainingMs > 0) {
          const remainingMinutes = Math.ceil(remainingMs / 60000)
          throw new ClientError(
            `You can import again in ${remainingMinutes} minute(s).`,
            429
          )
        }
      }
      await existing.remove()
    }

    await steamImportQueue.add('import', { userId }, { jobId })
    return { status: 'queued' as const }
  }

  async getImportStatus(userId: string) {
    const job = await steamImportQueue.getJob(steamImportJobId(userId))
    if (!job) return { status: 'idle' as const }

    const state = await job.getState()

    if (state === 'completed') {
      const cooldownUntil = job.finishedOn
        ? job.finishedOn + IMPORT_COOLDOWN_MS
        : undefined
      return {
        status: 'completed' as const,
        result: job.returnvalue as SteamImportJobResult,
        cooldownUntil:
          cooldownUntil && cooldownUntil > Date.now()
            ? cooldownUntil
            : undefined
      }
    }
    if (state === 'failed') {
      return { status: 'failed' as const, error: job.failedReason }
    }

    const progress = typeof job.progress === 'number' ? job.progress : undefined

    return { status: state as 'waiting' | 'active' | 'delayed', progress }
  }

  async runImport(
    userId: string,
    onProgress?: (percent: number) => void
  ): Promise<SteamImportJobResult> {
    const user = await this.requireUser(userId)
    if (!user.steamId) {
      throw new ClientError('Connect your Steam profile first.', 400)
    }
    const steamId = user.steamId

    const [ownedGames, wishlistItemsRaw] = await Promise.all([
      SteamApiService.getOwnedGames(steamId),
      SteamApiService.getWishlist(steamId)
    ])

    if (!ownedGames) {
      throw new ClientError(
        'Could not access your Steam library — make sure your profile is public and try again.',
        400
      )
    }

    const wishlistItems = (wishlistItemsRaw ?? []).map(w => ({
      appid: w.appid,
      name: `App ${w.appid}`
    }))

    const allAppIds = [
      ...ownedGames.map(g => g.appid),
      ...wishlistItems.map(w => w.appid)
    ]
    const matches = await IGDBService.getGamesBySteamAppIds(allAppIds)
    const appIdToIgdb = new Map(matches.map(m => [m.appId, m.game]))

    const ownedResolved = await this.resolveImportTargets(
      ownedGames,
      appIdToIgdb,
      userId
    )
    const wishlistResolved = await this.resolveImportTargets(
      wishlistItems,
      appIdToIgdb,
      userId
    )

    const total =
      ownedResolved.toImport.length + wishlistResolved.toImport.length
    let processed = 0
    const bump = () => {
      processed++
      onProgress?.(total === 0 ? 100 : Math.round((processed / total) * 100))
    }

    const library = await this.importOwnedGames(
      ownedResolved,
      userId,
      steamId,
      bump
    )
    const wishlist = await this.importWishlist(wishlistResolved, userId, bump)

    onProgress?.(100)

    return { library, wishlist }
  }

  private async importOwnedGames(
    {
      toImport,
      skipped,
      notFound
    }: {
      toImport: { item: SteamOwnedGame; igdbGame: IGDBGame }[]
      skipped: number
      notFound: string[]
    },
    userId: string,
    steamId: string,
    onItemDone: () => void
  ): Promise<SteamImportSectionResult> {
    const achievementSummaries = await mapWithConcurrency(
      toImport,
      ACHIEVEMENT_CHECK_CONCURRENCY,
      ({ item }) =>
        item.playtime_forever > 0
          ? SteamApiService.getPlayerAchievements(steamId, item.appid)
          : Promise.resolve(null)
    )

    let imported = 0

    for (let i = 0; i < toImport.length; i++) {
      const { item: owned, igdbGame } = toImport[i]
      const achievements = achievementSummaries[i]

      await this.gameCacheService.cacheMany([igdbGame])

      const secondsSinceLastPlayed =
        Math.floor(Date.now() / 1000) - (owned.rtime_last_played ?? 0)
      const recentlyPlayed =
        owned.playtime_forever > 0 &&
        secondsSinceLastPlayed <= RECENT_PLAY_THRESHOLD_SECONDS

      const isFinished =
        achievements != null &&
        achievements.total >= MIN_ACHIEVEMENTS_FOR_SIGNAL &&
        achievements.achieved / achievements.total >= FINISHED_ACHIEVEMENT_RATIO

      const statusId = isFinished
        ? PLAYED_STATUS_ID
        : recentlyPlayed
          ? PLAYING_STATUS_ID
          : BACKLOG_STATUS_ID

      await this.userRepository.addGameToUserLibrary({
        igdbId: igdbGame.id,
        userId,
        statusIds: statusId
      })
      await this.userRepository.createUserGameStats(userId, igdbGame.id)
      await this.userRepository.upsertUserGameHours(
        userId,
        igdbGame.id,
        Math.round((owned.playtime_forever / 60) * 100) / 100
      )

      imported++
      onItemDone()
    }

    return { imported, skipped, notFound }
  }

  private async importWishlist(
    {
      toImport,
      skipped,
      notFound
    }: {
      toImport: { item: { appid: number; name: string }; igdbGame: IGDBGame }[]
      skipped: number
      notFound: string[]
    },
    userId: string,
    onItemDone: () => void
  ): Promise<SteamImportSectionResult> {
    let imported = 0

    for (const { igdbGame } of toImport) {
      await this.gameCacheService.cacheMany([igdbGame])
      await this.userRepository.addGameToUserLibrary({
        igdbId: igdbGame.id,
        userId,
        statusIds: WISHLIST_STATUS_ID
      })
      await this.userRepository.createUserGameStats(userId, igdbGame.id)
      imported++
      onItemDone()
    }

    return { imported, skipped, notFound }
  }
}
