import { Platform, Prisma } from '@prisma/client'
import { prisma } from '../database/db'

export interface PlatformValues {
  hoursPlayed?: number | null
  completions?: number
  completedAt?: Date | null
}

const platformSelect = {
  platform: true,
  hoursPlayed: true,
  completions: true,
  completedAt: true
} satisfies Prisma.UserGamePlatformSelect

export class UserGamePlatformRepository {
  async findUserGameWithPlatforms(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: {
        id: true,
        userGamesStatusId: true,
        completedAt: true,
        UserGameStats: { select: { hoursPlayed: true, completions: true } },
        platforms: { select: platformSelect, orderBy: { platform: 'asc' } }
      }
    })
  }

  async savePlatform(
    userGameId: string,
    platform: Platform,
    values: PlatformValues
  ) {
    return prisma.$transaction(async tx => {
      await tx.userGamePlatform.upsert({
        where: { userGameId_platform: { userGameId, platform } },
        update: values,
        create: { userGameId, platform, ...values }
      })
      await this.recomputeTotals(tx, userGameId)
    })
  }

  async deletePlatform(userGameId: string, platform: Platform) {
    return prisma.$transaction(async tx => {
      await tx.userGamePlatform.delete({
        where: { userGameId_platform: { userGameId, platform } }
      })
      await this.recomputeTotals(tx, userGameId)
    })
  }

  async markSinglePlatformCompleted(userGameId: string, completedAt: Date) {
    return prisma.$transaction(async tx => {
      const platforms = await tx.userGamePlatform.findMany({
        where: { userGameId },
        select: { platform: true, completions: true, completedAt: true }
      })
      if (platforms.length !== 1) return

      const [only] = platforms
      await tx.userGamePlatform.update({
        where: { userGameId_platform: { userGameId, platform: only.platform } },
        data: {
          completions: Math.max(only.completions, 1),
          completedAt: only.completedAt ?? completedAt
        }
      })
      await this.recomputeTotals(tx, userGameId)
    })
  }

  private async recomputeTotals(
    tx: Prisma.TransactionClient,
    userGameId: string
  ) {
    const platforms = await tx.userGamePlatform.findMany({
      where: { userGameId },
      select: { hoursPlayed: true, completions: true, completedAt: true }
    })

    const hoursPlayed = platforms.some(p => p.hoursPlayed !== null)
      ? platforms.reduce((sum, p) => sum + Number(p.hoursPlayed ?? 0), 0)
      : null
    const completions = platforms.reduce((sum, p) => sum + p.completions, 0)
    const completedDates = platforms
      .map(p => p.completedAt)
      .filter((d): d is Date => d !== null)
    const earliestCompletedAt =
      completedDates.length > 0
        ? new Date(Math.min(...completedDates.map(d => d.getTime())))
        : null

    await tx.userGameStats.upsert({
      where: { userGameId },
      update: { hoursPlayed, completions },
      create: { userGameId, hoursPlayed, completions }
    })

    if (earliestCompletedAt) {
      await tx.userGame.update({
        where: { id: userGameId },
        data: { completedAt: earliestCompletedAt }
      })
    }
  }
}
