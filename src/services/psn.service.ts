import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { IGDBService } from './igdb.service'
import {
  PsnApiError,
  PsnApiService,
  PsnEarnedTrophy,
  PsnPlayedGame,
  PsnTrophySummary
} from './psn-api.service'
import {
  COMPLETION_KEYWORD_PATTERN,
  canInferCompletion,
  MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL,
  meetsCompletionRatio,
  RARE_ACHIEVEMENT_PERCENT
} from '../utils/completion-heuristics'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import { IGDBGame } from '../types/igdb'
import { normalizeGameName } from '../utils/normalize-game-name'
import {
  psnImportQueue,
  psnImportJobId,
  PsnImportJobResult
} from '../queues/psn-import.queue'
import { enqueueUniqueImport, getImportJobStatus } from '../queues/import-job'
import { UserGamePlatformService } from './user-game-platform.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'

const PLAYED_STATUS_ID = 1
const PLAYING_STATUS_ID = 3
const BACKLOG_STATUS_ID = 4
const RECENT_PLAY_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

const MIN_RATIO_FOR_TROPHY_LOOKUP = 0.1
const MAX_TROPHY_LOOKUPS = 40
const TROPHY_LOOKUP_CONCURRENCY = 2

interface CompletionSignal {
  finished: boolean
  completedAt?: Date
}

function earliest(trophies: PsnEarnedTrophy[]): Date | undefined {
  const times = trophies.flatMap(t => (t.earnedAt ? [t.earnedAt.getTime()] : []))
  return times.length > 0 ? new Date(Math.min(...times)) : undefined
}

function finishedBySummary(summary: PsnTrophySummary, igdbGame: IGDBGame) {
  if (summary.hasPlatinum || summary.progress >= 100) return true
  return (
    canInferCompletion(igdbGame) &&
    meetsCompletionRatio(summary.earned, summary.total)
  )
}

function finishedByTrophies(
  summary: PsnTrophySummary,
  earnedTrophies: PsnEarnedTrophy[]
): CompletionSignal {
  const story = earnedTrophies.filter(t =>
    COMPLETION_KEYWORD_PATTERN.test(t.detail)
  )
  const rare =
    summary.total <= MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL
      ? earnedTrophies.filter(
          t => t.earnedRate !== null && t.earnedRate <= RARE_ACHIEVEMENT_PERCENT
        )
      : []

  if (story.length === 0 && rare.length === 0) return { finished: false }
  return {
    finished: true,
    completedAt:
      earliest(story) ?? earliest(rare) ?? summary.lastTrophyAt ?? undefined
  }
}

const PSN_VERIFICATION_TTL_SECONDS = 15 * 60
const psnVerificationKey = (userId: string) => `psn-verification:${userId}`

interface PendingPsnVerification {
  accountId: string
  onlineId: string
  code: string
}

interface MergedPsnGame {
  conceptId: string
  name: string
  titleIds: string[]
  playMinutes: number
  lastPlayedAt: Date | null
}

function mergeByConcept(games: PsnPlayedGame[]) {
  const byConcept = new Map<string, MergedPsnGame>()
  const withoutConcept: string[] = []

  for (const game of games) {
    if (!game.conceptId) {
      withoutConcept.push(game.name)
      continue
    }

    const existing = byConcept.get(game.conceptId)
    if (!existing) {
      byConcept.set(game.conceptId, {
        conceptId: game.conceptId,
        name: game.name,
        titleIds: [game.titleId],
        playMinutes: game.playMinutes,
        lastPlayedAt: game.lastPlayedAt
      })
      continue
    }

    existing.titleIds.push(game.titleId)
    existing.playMinutes += game.playMinutes
    if (
      game.lastPlayedAt &&
      (!existing.lastPlayedAt || game.lastPlayedAt > existing.lastPlayedAt)
    ) {
      existing.lastPlayedAt = game.lastPlayedAt
    }
  }

  return { merged: [...byConcept.values()], withoutConcept }
}

function bestSummary(
  a: PsnTrophySummary | undefined,
  b: PsnTrophySummary | undefined
): PsnTrophySummary | undefined {
  if (!a) return b
  if (!b) return a
  if (a.hasPlatinum !== b.hasPlatinum) return a.hasPlatinum ? a : b
  return a.progress >= b.progress ? a : b
}

export class PsnService {
  constructor(
    private userRepository: UserRepository,
    private gameCacheService: GameCacheService,
    private psnApiService: PsnApiService,
    private userGamePlatformService: UserGamePlatformService = new UserGamePlatformService(
      new UserGamePlatformRepository(),
      userRepository
    ),
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  private async lookupProfile(onlineId: string) {
    try {
      return await this.psnApiService.findProfile(onlineId)
    } catch (err) {
      if (err instanceof PsnApiError) {
        console.error('[PSN] profile lookup failed', { error: err.message })
        throw new ClientError(
          'Não foi possível consultar a PlayStation Network. Tente novamente mais tarde.',
          502
        )
      }
      throw err
    }
  }

  async startPsnVerification(userId: string, onlineIdInput: string) {
    await this.requireUser(userId)

    const profile = await this.lookupProfile(onlineIdInput.trim())
    if (!profile) {
      throw new ClientError(
        'Não foi possível encontrar um perfil da PlayStation com esse ID.',
        400
      )
    }

    const code = `LIB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    const pending: PendingPsnVerification = {
      accountId: profile.accountId,
      onlineId: profile.onlineId,
      code
    }
    await this.cacheRepository.set(
      psnVerificationKey(userId),
      pending,
      PSN_VERIFICATION_TTL_SECONDS
    )

    return {
      psnOnlineId: profile.onlineId,
      code,
      expiresInSeconds: PSN_VERIFICATION_TTL_SECONDS
    }
  }

  async connectPsn(userId: string) {
    await this.requireUser(userId)

    const pending = (await this.cacheRepository.get(
      psnVerificationKey(userId)
    )) as PendingPsnVerification | null
    if (!pending) {
      throw new ClientError(
        'A verificação expirou. Gere um novo código e tente novamente.',
        400
      )
    }

    const profile = await this.lookupProfile(pending.onlineId)
    if (
      !profile ||
      profile.accountId !== pending.accountId ||
      !profile.aboutMe.includes(pending.code)
    ) {
      throw new ClientError(
        'Não encontramos o código no "Sobre mim" do seu perfil da PSN. Salve o código no perfil e tente novamente.',
        400
      )
    }

    try {
      await this.userRepository.setPsnAccount(userId, {
        accountId: profile.accountId,
        onlineId: profile.onlineId
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ClientError(
          'Este perfil da PlayStation já está vinculado a outra conta.',
          409
        )
      }
      throw err
    }

    await this.cacheRepository.del(psnVerificationKey(userId))

    return { psnOnlineId: profile.onlineId }
  }

  async disconnectPsn(userId: string) {
    await this.requireUser(userId)
    await this.userRepository.setPsnAccount(userId, null)
  }

  async enqueueImport(userId: string) {
    const user = await this.requireUser(userId)
    if (!user.psnAccountId) {
      throw new ClientError('Conecte seu perfil da PlayStation primeiro.', 400)
    }

    return enqueueUniqueImport(
      psnImportQueue,
      psnImportJobId(userId),
      { userId },
      'PlayStation'
    )
  }

  async getImportStatus(userId: string) {
    return getImportJobStatus<PsnImportJobResult>(
      psnImportQueue,
      psnImportJobId(userId)
    )
  }

  async runImport(
    userId: string,
    onProgress?: (percent: number) => void
  ): Promise<PsnImportJobResult> {
    const user = await this.requireUser(userId)
    if (!user.psnAccountId) {
      throw new ClientError('Conecte seu perfil da PlayStation primeiro.', 400)
    }
    const accountId = user.psnAccountId

    let playedGames: PsnPlayedGame[]
    try {
      playedGames = await this.psnApiService.getPlayedGames(accountId)
    } catch (err) {
      if (err instanceof PsnApiError) {
        throw new ClientError(
          'Não foi possível acessar seus jogos da PlayStation — verifique se o histórico de jogos do seu perfil está visível para todos e tente novamente.',
          400
        )
      }
      throw err
    }

    const { merged, withoutConcept } = mergeByConcept(playedGames)
    const notFound = [...withoutConcept]

    const matches = await IGDBService.getGamesByExternalIds(
      merged.map(g => g.conceptId),
      IGDBService.PSN_EXTERNAL_GAME_SOURCE
    )
    const conceptToIgdb = new Map(matches.map(m => [m.uid, m.game]))

    let skipped = 0
    const toImport: { game: MergedPsnGame; igdbGame: IGDBGame }[] = []
    const queuedIgdbIds = new Set<number>()

    for (const game of merged) {
      const igdbGame = conceptToIgdb.get(game.conceptId)
      if (!igdbGame) {
        notFound.push(game.name)
        continue
      }
      if (queuedIgdbIds.has(igdbGame.id)) {
        skipped++
        continue
      }
      queuedIgdbIds.add(igdbGame.id)
      toImport.push({ game, igdbGame })
    }

    const trophies = await this.loadTrophySummaries(
      accountId,
      toImport.map(t => t.game)
    )

    const completion = await this.detectCompletion(accountId, toImport, trophies)

    const total = toImport.length
    let imported = 0
    let updated = 0
    const now = Date.now()

    for (const { game, igdbGame } of toImport) {
      const summary = trophies.get(game.conceptId)
      const signal = completion.get(game.conceptId)
      const isFinished = signal?.finished ?? false
      const isRecent =
        game.playMinutes > 0 &&
        !!game.lastPlayedAt &&
        now - game.lastPlayedAt.getTime() <= RECENT_PLAY_THRESHOLD_MS

      const statusId = isFinished
        ? PLAYED_STATUS_ID
        : isRecent
          ? PLAYING_STATUS_ID
          : BACKLOG_STATUS_ID

      const completedAt = isFinished
        ? (signal?.completedAt ??
          summary?.lastTrophyAt ??
          game.lastPlayedAt ??
          undefined)
        : undefined

      await this.gameCacheService.cacheMany([igdbGame])
      const outcome = await this.userGamePlatformService.importPlatform(
        userId,
        igdbGame.id,
        'PLAYSTATION',
        {
          statusId,
          hoursPlayed: Math.round((game.playMinutes / 60) * 100) / 100,
          finished: isFinished,
          completedAt
        }
      )

      if (outcome === 'imported') imported++
      else updated++
      onProgress?.(Math.round(((imported + updated) / total) * 100))
    }

    onProgress?.(100)

    return { library: { imported, updated, skipped, notFound } }
  }

  private async detectCompletion(
    accountId: string,
    games: { game: MergedPsnGame; igdbGame: IGDBGame }[],
    trophies: Map<string, PsnTrophySummary>
  ): Promise<Map<string, CompletionSignal>> {
    const result = new Map<string, CompletionSignal>()
    const needsLookup: { conceptId: string; summary: PsnTrophySummary }[] = []

    for (const { game, igdbGame } of games) {
      const summary = trophies.get(game.conceptId)
      if (!summary) continue

      if (finishedBySummary(summary, igdbGame)) {
        result.set(game.conceptId, { finished: true })
      } else if (
        canInferCompletion(igdbGame) &&
        summary.total > 0 &&
        summary.earned / summary.total >= MIN_RATIO_FOR_TROPHY_LOOKUP
      ) {
        needsLookup.push({ conceptId: game.conceptId, summary })
      }
    }

    const lookups = needsLookup
      .sort(
        (a, b) =>
          b.summary.earned / b.summary.total - a.summary.earned / a.summary.total
      )
      .slice(0, MAX_TROPHY_LOOKUPS)

    let lookupFailed = false
    await mapWithConcurrency(
      lookups,
      TROPHY_LOOKUP_CONCURRENCY,
      async ({ conceptId, summary }) => {
        if (lookupFailed) return
        try {
          const earnedTrophies = await this.psnApiService.getEarnedTrophies(
            accountId,
            summary
          )
          result.set(conceptId, finishedByTrophies(summary, earnedTrophies))
        } catch (err) {
          if (!(err instanceof PsnApiError)) throw err
          if (!lookupFailed) {
            console.warn(
              '[PSN] trophy detail lookup failed, using summaries only',
              { error: err.message }
            )
          }
          lookupFailed = true
        }
      }
    )

    return result
  }

  private async loadTrophySummaries(
    accountId: string,
    games: MergedPsnGame[]
  ): Promise<Map<string, PsnTrophySummary>> {
    const result = new Map<string, PsnTrophySummary>()
    if (games.length === 0) return result

    try {
      const byName = await this.psnApiService.getTrophySummariesByName(
        accountId
      )
      const unmatched: MergedPsnGame[] = []

      for (const game of games) {
        const summary = byName.get(normalizeGameName(game.name))
        if (summary) result.set(game.conceptId, summary)
        else unmatched.push(game)
      }

      if (unmatched.length === 0) return result

      const byTitleId = await this.psnApiService.getTrophySummariesByTitleId(
        accountId,
        unmatched.flatMap(g => g.titleIds)
      )
      for (const game of unmatched) {
        const summary = game.titleIds
          .map(id => byTitleId.get(id))
          .reduce(bestSummary, undefined)
        if (summary) result.set(game.conceptId, summary)
      }
    } catch (err) {
      if (!(err instanceof PsnApiError)) throw err
      console.warn('[PSN] trophy lookup failed, importing without completion data', {
        error: err.message
      })
    }

    return result
  }
}
