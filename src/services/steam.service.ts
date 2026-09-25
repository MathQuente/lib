import { Prisma } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { IGDBService } from './igdb.service'
import {
  SteamApiService,
  SteamAchievementSummary,
  SteamOwnedGame
} from './steam-api.service'
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
const ACHIEVEMENT_CHECK_CONCURRENCY = 10

const RARE_ACHIEVEMENT_PERCENT = 5

const MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL = 100

const RATIO_THRESHOLDS: { maxTotal: number; ratio: number }[] = [
  { maxTotal: 10, ratio: 0.9 },
  { maxTotal: 30, ratio: 0.7 },
  { maxTotal: 75, ratio: 0.4 },
  { maxTotal: 150, ratio: 0.3 },
  { maxTotal: Infinity, ratio: 0.15 }
]

function requiredRatioForTotal(total: number): number {
  return RATIO_THRESHOLDS.find(t => total <= t.maxTotal)!.ratio
}

const COMPLETION_KEYWORD_PATTERN =
  /\bending\b|\bfinal boss\b|\bcomplete(d)? the game\b|\bbeat the game\b|\bfinish(ed)? the (game|story|campaign)\b|\bcredits\b|\bepilogue\b/i

function matchingCompletionKeywordNames(
  achievedApiNames: string[],
  schema: Map<string, string> | null
): string[] {
  if (!schema) return []
  return achievedApiNames.filter(name => {
    const description = schema.get(name)
    return !!description && COMPLETION_KEYWORD_PATTERN.test(description)
  })
}

function resolveCompletedAt(
  achievements: SteamAchievementSummary,
  matchedKeywordNames: string[],
  matchedRareNames: string[]
): Date {
  const earliestOf = (names: string[]): number | null => {
    const times = names
      .map(name => achievements.unlockTimesByName.get(name) ?? 0)
      .filter(time => time > 0)
    return times.length > 0 ? Math.min(...times) : null
  }

  const keywordTime = earliestOf(matchedKeywordNames)
  if (keywordTime !== null) return new Date(keywordTime * 1000)

  const rareTime = earliestOf(matchedRareNames)
  if (rareTime !== null) return new Date(rareTime * 1000)

  const latestUnlock = achievements.achievedApiNames
    .map(name => achievements.unlockTimesByName.get(name) ?? 0)
    .filter(time => time > 0)
  if (latestUnlock.length > 0) return new Date(Math.max(...latestUnlock) * 1000)

  return new Date()
}

function hasSinglePlayerMode(game: IGDBGame): boolean {
  const modes = game.game_modes?.map(m => m.name.toLowerCase())
  if (!modes || modes.length === 0) return true
  return modes.includes('single player')
}

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
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
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
        'Não foi possível encontrar um perfil da Steam com esse link ou ID.',
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
          'Este perfil da Steam já está vinculado a outra conta.',
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
      throw new ClientError('Conecte seu perfil da Steam primeiro.', 400)
    }

    const jobId = steamImportJobId(userId)
    const existing = await steamImportQueue.getJob(jobId)

    if (existing) {
      const state = await existing.getState()
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        throw new ClientError('Já existe uma importação da Steam em andamento.', 409)
      }
      if (state === 'completed' && existing.finishedOn) {
        const remainingMs =
          existing.finishedOn + IMPORT_COOLDOWN_MS - Date.now()
        if (remainingMs > 0) {
          const remainingMinutes = Math.ceil(remainingMs / 60000)
          throw new ClientError(
            `Você pode importar novamente em ${remainingMinutes} minuto(s).`,
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
      throw new ClientError('Conecte seu perfil da Steam primeiro.', 400)
    }
    const steamId = user.steamId

    const [ownedGames, wishlistItemsRaw] = await Promise.all([
      SteamApiService.getOwnedGames(steamId),
      SteamApiService.getWishlist(steamId)
    ])

    if (!ownedGames) {
      throw new ClientError(
        'Não foi possível acessar sua biblioteca da Steam — verifique se seu perfil está público e tente novamente.',
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
    const achievementData = await mapWithConcurrency(
      toImport,
      ACHIEVEMENT_CHECK_CONCURRENCY,
      async ({ item, igdbGame }) => {
        if (item.playtime_forever <= 0) return null
        if (!hasSinglePlayerMode(igdbGame)) return null

        const [achievements, globalPercentages, schema] = await Promise.all([
          SteamApiService.getPlayerAchievements(steamId, item.appid),
          SteamApiService.getGlobalAchievementPercentages(item.appid),
          SteamApiService.getAchievementSchema(item.appid)
        ])

        return { achievements, globalPercentages, schema }
      }
    )

    let imported = 0

    for (let i = 0; i < toImport.length; i++) {
      const { item: owned, igdbGame } = toImport[i]
      const achievements = achievementData[i]?.achievements ?? null
      const globalPercentages = achievementData[i]?.globalPercentages ?? null
      const schema = achievementData[i]?.schema ?? null

      await this.gameCacheService.cacheMany([igdbGame])

      const secondsSinceLastPlayed =
        Math.floor(Date.now() / 1000) - (owned.rtime_last_played ?? 0)
      const recentlyPlayed =
        owned.playtime_forever > 0 &&
        secondsSinceLastPlayed <= RECENT_PLAY_THRESHOLD_SECONDS

      const matchedRareNames =
        achievements != null &&
        achievements.total <= MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL &&
        globalPercentages != null
          ? achievements.achievedApiNames.filter(name => {
              const percent = globalPercentages.get(name)
              return percent !== undefined && percent <= RARE_ACHIEVEMENT_PERCENT
            })
          : []
      const hasRareAchievement = matchedRareNames.length > 0

      const meetsRatioThreshold =
        achievements != null &&
        achievements.total >= MIN_ACHIEVEMENTS_FOR_SIGNAL &&
        achievements.achieved / achievements.total >=
          requiredRatioForTotal(achievements.total)

      const matchedKeywordNames = achievements
        ? matchingCompletionKeywordNames(achievements.achievedApiNames, schema)
        : []
      const hasCompletionKeyword = matchedKeywordNames.length > 0

      const isFinished =
        hasRareAchievement || hasCompletionKeyword || meetsRatioThreshold

      const statusId = isFinished
        ? PLAYED_STATUS_ID
        : recentlyPlayed
          ? PLAYING_STATUS_ID
          : BACKLOG_STATUS_ID

      const completedAt =
        isFinished && achievements
          ? resolveCompletedAt(achievements, matchedKeywordNames, matchedRareNames)
          : undefined

      await this.userRepository.addGameToUserLibrary({
        igdbId: igdbGame.id,
        userId,
        statusIds: statusId,
        completedAt
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
