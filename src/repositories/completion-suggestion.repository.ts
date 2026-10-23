import { Platform, Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { isUniqueViolation } from '../utils/prisma-errors'

export const SUGGESTIBLE_STATUS_IDS = [2, 3, 4]

export interface SuggestionEvidence {
  hoursPlayed: number
  normallyHours: number | null
  achieved: number | null
  total: number | null
  signals: string[]
}

export interface GameState {
  statusId: number
  completedAt: string | null
  completions: number
  platformRows: {
    id: string
    completions: number
    completedAt: string | null
  }[]
}

export interface UndoSnapshot {
  before: GameState
  after: GameState
}

export interface PendingSuggestionRow {
  igdbId: number
  name: string | null
  coverUrl: string | null
  platform: Platform
  evidence: SuggestionEvidence
  lowConfidence: boolean
  createdAt: Date
}

export class CompletionSuggestionRepository {
  async findGameForRecord(userId: string, igdbId: number) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: {
        id: true,
        userGamesStatusId: true,
        endless: true,
        UserGameStats: { select: { completions: true } }
      }
    })
    if (!userGame) return null
    return {
      id: userGame.id,
      statusId: userGame.userGamesStatusId,
      endless: userGame.endless,
      completions: userGame.UserGameStats?.completions ?? 0
    }
  }

  async upsertPending(
    userGameId: string,
    platform: Platform,
    evidence: SuggestionEvidence,
    lowConfidence: boolean
  ): Promise<boolean> {
    const updated = await prisma.completionSuggestion.updateMany({
      where: { userGameId, status: 'PENDING' },
      data: {
        platform,
        evidence: evidence as unknown as Prisma.InputJsonValue,
        lowConfidence
      }
    })
    if (updated.count > 0) return true

    const existing = await prisma.completionSuggestion.findUnique({
      where: { userGameId },
      select: { id: true }
    })
    if (existing) return false

    try {
      await prisma.completionSuggestion.create({
        data: {
          userGameId,
          platform,
          evidence: evidence as unknown as Prisma.InputJsonValue,
          lowConfidence
        }
      })
    } catch (error) {
      if (isUniqueViolation(error)) return false
      throw error
    }
    return true
  }

  async listPending(userId: string, platform?: Platform) {
    const platformFilter = platform
      ? Prisma.sql`AND cs.platform = ${platform}::"Platform"`
      : Prisma.empty

    return prisma.$queryRaw<PendingSuggestionRow[]>(Prisma.sql`
      SELECT
        ug.igdb_id        AS "igdbId",
        gc.name           AS "name",
        gc.cover_url      AS "coverUrl",
        cs.platform       AS "platform",
        cs.evidence       AS "evidence",
        cs.low_confidence AS "lowConfidence",
        cs.created_at     AS "createdAt"
      FROM completion_suggestions cs
      JOIN user_games ug ON ug.id = cs.user_game_id
      LEFT JOIN games_cache gc ON gc.igdb_id = ug.igdb_id
      WHERE ug.user_id = ${userId}
        AND cs.status = 'PENDING'
        AND ug.user_games_status_id IN (${Prisma.join(SUGGESTIBLE_STATUS_IDS)})
        ${platformFilter}
      ORDER BY cs.created_at DESC, gc.name ASC
    `)
  }

  async findByUserAndIgdbId(userId: string, igdbId: number) {
    return prisma.completionSuggestion.findFirst({
      where: { userGame: { userId, igdbId } },
      select: {
        id: true,
        userGameId: true,
        platform: true,
        status: true,
        undoSnapshot: true
      }
    })
  }

  async readGameState(
    userGameId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<GameState | null> {
    const userGame = await client.userGame.findUnique({
      where: { id: userGameId },
      select: {
        userGamesStatusId: true,
        completedAt: true,
        UserGameStats: { select: { completions: true } },
        platforms: {
          select: { id: true, completions: true, completedAt: true }
        }
      }
    })
    if (!userGame) return null
    return {
      statusId: userGame.userGamesStatusId,
      completedAt: userGame.completedAt?.toISOString() ?? null,
      completions: userGame.UserGameStats?.completions ?? 0,
      platformRows: userGame.platforms.map(p => ({
        id: p.id,
        completions: p.completions,
        completedAt: p.completedAt?.toISOString() ?? null
      }))
    }
  }

  async claimPending(id: string) {
    const claimed = await prisma.completionSuggestion.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED', resolvedAt: new Date() }
    })
    return claimed.count > 0
  }

  async releaseClaim(id: string) {
    return prisma.completionSuggestion.updateMany({
      where: {
        id,
        status: 'ACCEPTED',
        undoSnapshot: { equals: Prisma.DbNull }
      },
      data: { status: 'PENDING', resolvedAt: null }
    })
  }

  async markDismissed(id: string) {
    return prisma.completionSuggestion.update({
      where: { id },
      data: { status: 'DISMISSED', resolvedAt: new Date() }
    })
  }

  async markAccepted(id: string, snapshot: UndoSnapshot) {
    return prisma.completionSuggestion.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        resolvedAt: new Date(),
        undoSnapshot: snapshot as unknown as Prisma.InputJsonValue
      }
    })
  }

  async restore(
    id: string,
    userGameId: string,
    before: GameState,
    isUnchanged: (current: GameState) => boolean
  ): Promise<'restored' | 'not_accepted' | 'changed'> {
    return prisma.$transaction(async tx => {
      const current = await this.readGameState(userGameId, tx)
      if (!current || !isUnchanged(current)) return 'changed'

      const claimed = await tx.completionSuggestion.updateMany({
        where: { id, status: 'ACCEPTED' },
        data: {
          status: 'PENDING',
          resolvedAt: null,
          undoSnapshot: Prisma.DbNull
        }
      })
      if (claimed.count === 0) return 'not_accepted'

      await tx.userGame.update({
        where: { id: userGameId },
        data: {
          userGamesStatusId: before.statusId,
          completedAt: before.completedAt ? new Date(before.completedAt) : null
        }
      })
      await tx.userGameStats.updateMany({
        where: { userGameId },
        data: { completions: before.completions }
      })
      for (const row of before.platformRows) {
        await tx.userGamePlatform.update({
          where: { id: row.id },
          data: {
            completions: row.completions,
            completedAt: row.completedAt ? new Date(row.completedAt) : null
          }
        })
      }
      return 'restored'
    })
  }
}
