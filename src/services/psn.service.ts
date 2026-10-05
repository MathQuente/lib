import { Prisma } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { IGDBService } from './igdb.service'
import {
  PsnApiError,
  PsnApiService,
  PsnPlayedGame,
  PsnTrophySummary
} from './psn-api.service'
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
    )
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async connectPsn(userId: string, onlineIdInput: string) {
    await this.requireUser(userId)

    let profile: { accountId: string; onlineId: string } | null
    try {
      profile = await this.psnApiService.findProfile(onlineIdInput.trim())
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

    if (!profile) {
      throw new ClientError(
        'Não foi possível encontrar um perfil da PlayStation com esse ID.',
        400
      )
    }

    try {
      await this.userRepository.setPsnAccount(userId, profile)
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

    const total = toImport.length
    let imported = 0
    let updated = 0
    const now = Date.now()

    for (const { game, igdbGame } of toImport) {
      const summary = trophies.get(game.conceptId)
      const isFinished =
        !!summary && (summary.hasPlatinum || summary.progress >= 100)
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
        ? (summary?.lastTrophyAt ?? game.lastPlayedAt ?? undefined)
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
