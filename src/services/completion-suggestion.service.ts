import { Platform } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import {
  CompletionSuggestionRepository,
  GameState,
  SUGGESTIBLE_STATUS_IDS,
  SuggestionEvidence,
  UndoSnapshot
} from '../repositories/completion-suggestion.repository'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserService } from './users.service'
import { PLAYED_STATUS_ID, STATUS_NAME_BY_ID } from '../utils/library-status'

export interface CompletionSuggestionRecorder {
  record(
    userId: string,
    igdbId: number,
    platform: Platform,
    evidence: SuggestionEvidence,
    lowConfidence: boolean
  ): Promise<boolean>
}

function sameState(a: GameState, b: GameState) {
  if (
    a.statusId !== b.statusId ||
    a.completedAt !== b.completedAt ||
    a.completions !== b.completions ||
    a.platformRows.length !== b.platformRows.length
  ) {
    return false
  }
  return a.platformRows.every(row => {
    const other = b.platformRows.find(r => r.id === row.id)
    return (
      !!other &&
      other.completions === row.completions &&
      other.completedAt === row.completedAt
    )
  })
}

export class CompletionSuggestionService implements CompletionSuggestionRecorder {
  constructor(
    private repository: CompletionSuggestionRepository,
    private userService: Pick<UserService, 'updateGame'>,
    private platformRepository: Pick<
      UserGamePlatformRepository,
      'markSinglePlatformCompleted'
    >
  ) {}

  async record(
    userId: string,
    igdbId: number,
    platform: Platform,
    evidence: SuggestionEvidence,
    lowConfidence: boolean
  ) {
    const game = await this.repository.findGameForRecord(userId, igdbId)
    if (!game) return false
    if (
      !SUGGESTIBLE_STATUS_IDS.includes(game.statusId) ||
      game.endless ||
      game.completions > 0
    ) {
      return false
    }
    return this.repository.upsertPending(
      game.id,
      platform,
      evidence,
      lowConfidence
    )
  }

  async list(userId: string, platform?: Platform) {
    const rows = await this.repository.listPending(userId, platform)

    return {
      suggestions: rows.map(row => ({
        igdbId: row.igdbId,
        name: row.name ?? `Jogo ${row.igdbId}`,
        coverUrl: row.coverUrl,
        platform: row.platform,
        hoursPlayed: row.evidence.hoursPlayed,
        normallyHours: row.evidence.normallyHours,
        achieved: row.evidence.achieved,
        total: row.evidence.total,
        lowConfidence: row.lowConfidence,
        createdAt: row.createdAt.toISOString()
      }))
    }
  }

  private async requireSuggestion(userId: string, igdbId: number) {
    const suggestion = await this.repository.findByUserAndIgdbId(userId, igdbId)
    if (!suggestion) throw new ClientError('Sugestão não encontrada.', 404)
    return suggestion
  }

  async accept(userId: string, igdbId: number) {
    const suggestion = await this.requireSuggestion(userId, igdbId)
    if (suggestion.status !== 'PENDING') {
      throw new ClientError('Esta sugestão já foi resolvida.', 409)
    }

    const before = await this.repository.readGameState(suggestion.userGameId)
    if (!before)
      throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
    if (before.statusId === PLAYED_STATUS_ID) {
      throw new ClientError('Este jogo já está em Jogado.', 409)
    }

    const claimed = await this.repository.claimPending(suggestion.id)
    if (!claimed) {
      throw new ClientError('Esta sugestão já foi resolvida.', 409)
    }

    try {
      await this.userService.updateGame(igdbId, userId, PLAYED_STATUS_ID)

      let after = await this.repository.readGameState(suggestion.userGameId)
      if (after && after.completions === 0) {
        await this.platformRepository.markSinglePlatformCompleted(
          suggestion.userGameId,
          new Date(),
          suggestion.platform
        )
        after = await this.repository.readGameState(suggestion.userGameId)
      }
      if (!after) {
        throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
      }

      await this.repository.markAccepted(suggestion.id, { before, after })

      return {
        igdbId,
        status: 'PLAYED' as const,
        completions: after.completions,
        canUndo: true
      }
    } catch (error) {
      await this.repository.releaseClaim(suggestion.id)
      throw error
    }
  }

  async dismiss(userId: string, igdbId: number) {
    const suggestion = await this.requireSuggestion(userId, igdbId)
    if (suggestion.status === 'DISMISSED') return
    if (suggestion.status !== 'PENDING') {
      throw new ClientError('Esta sugestão já foi resolvida.', 409)
    }
    await this.repository.markDismissed(suggestion.id)
  }

  async undo(userId: string, igdbId: number) {
    const suggestion = await this.requireSuggestion(userId, igdbId)
    const snapshot = suggestion.undoSnapshot as unknown as UndoSnapshot | null
    if (suggestion.status !== 'ACCEPTED' || !snapshot) {
      throw new ClientError('Não há o que desfazer nesta sugestão.', 409)
    }

    const outcome = await this.repository.restore(
      suggestion.id,
      suggestion.userGameId,
      snapshot.before,
      current => sameState(current, snapshot.after)
    )
    if (outcome === 'changed') {
      throw new ClientError(
        'O jogo mudou depois de marcado. Ajuste o status manualmente.',
        409
      )
    }
    if (outcome === 'not_accepted') {
      throw new ClientError('Não há o que desfazer nesta sugestão.', 409)
    }

    return {
      igdbId,
      status: STATUS_NAME_BY_ID[snapshot.before.statusId] ?? 'BACKLOG',
      completions: snapshot.before.completions
    }
  }
}
