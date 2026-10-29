import { Console, Platform, Prisma } from '@prisma/client'
import { prisma } from '../database/db'

export interface PlatformValues {
  hoursPlayed?: number | null
  completions?: number
  completedAt?: Date | null
}

export interface AccountHours {
  accountId: string
  hours: number
}

const platformBaseSelect = {
  platform: true,
  console: true,
  hoursPlayed: true,
  completions: true,
  completedAt: true
} satisfies Prisma.UserGamePlatformSelect

const platformSelect = {
  ...platformBaseSelect,
  accountHours: {
    select: {
      hoursPlayed: true,
      xboxAccount: { select: { gamertag: true } }
    },
    orderBy: { xboxAccount: { gamertag: 'asc' } }
  }
} satisfies Prisma.UserGamePlatformSelect

const platformOrder = [
  { platform: 'asc' },
  { console: 'asc' }
] satisfies Prisma.UserGamePlatformOrderByWithRelationInput[]

const userGameHeaderSelect = {
  id: true,
  userGamesStatusId: true,
  endless: true,
  completedAt: true,
  UserGameStats: { select: { hoursPlayed: true, completions: true } }
} satisfies Prisma.UserGameSelect

const REMOVE_ACCOUNT_TIMEOUT_MS = 30_000

type AccountHoursRow = {
  hoursPlayed: Prisma.Decimal
  xboxAccount: { gamertag: string }
}

export class UserGamePlatformRepository {
  async findUserGameWithPlatforms(
    igdbId: number,
    userId: string,
    options: { accountHours?: boolean } = {}
  ) {
    const where = { userId_igdbId: { userId, igdbId } }
    if (options.accountHours ?? true) {
      return prisma.userGame.findUnique({
        where,
        select: {
          ...userGameHeaderSelect,
          platforms: { select: platformSelect, orderBy: platformOrder }
        }
      })
    }
    const found = await prisma.userGame.findUnique({
      where,
      select: {
        ...userGameHeaderSelect,
        platforms: { select: platformBaseSelect, orderBy: platformOrder }
      }
    })
    return (
      found && {
        ...found,
        platforms: found.platforms.map(row => ({
          ...row,
          accountHours: [] as AccountHoursRow[]
        }))
      }
    )
  }

  async savePlatform(
    userGameId: string,
    platform: Platform,
    gameConsole: Console,
    values: PlatformValues,
    accountHours?: AccountHours
  ) {
    return prisma.$transaction(async tx => {
      const accountExists = await this.lockAccount(tx, accountHours)
      const row = await tx.userGamePlatform.upsert({
        where: {
          userGameId_platform_console: {
            userGameId,
            platform,
            console: gameConsole
          }
        },
        update: values,
        create: { userGameId, platform, console: gameConsole, ...values }
      })
      if (accountHours) {
        await this.applyAccountHours(tx, row.id, accountHours, accountExists)
      }
      await this.recomputeTotals(tx, userGameId)
    })
  }

  async adoptConsole(
    userGameId: string,
    platform: Platform,
    from: Console,
    to: Console,
    values: PlatformValues,
    accountHours?: AccountHours
  ) {
    return prisma.$transaction(async tx => {
      const accountExists = await this.lockAccount(tx, accountHours)
      const row = await tx.userGamePlatform.update({
        where: {
          userGameId_platform_console: { userGameId, platform, console: from }
        },
        data: { console: to, ...values }
      })
      if (accountHours) {
        await this.applyAccountHours(tx, row.id, accountHours, accountExists)
      }
      await this.recomputeTotals(tx, userGameId)
    })
  }

  async deletePlatform(
    userGameId: string,
    platform: Platform,
    gameConsole: Console
  ) {
    return prisma.$transaction(async tx => {
      await tx.userGamePlatform.delete({
        where: {
          userGameId_platform_console: {
            userGameId,
            platform,
            console: gameConsole
          }
        }
      })
      await this.recomputeTotals(tx, userGameId)
    })
  }

  async markSinglePlatformCompleted(
    userGameId: string,
    completedAt: Date,
    platform?: Platform
  ) {
    return prisma.$transaction(async tx => {
      const platforms = await tx.userGamePlatform.findMany({
        where: { userGameId, ...(platform ? { platform } : {}) },
        select: {
          platform: true,
          console: true,
          completions: true,
          completedAt: true
        }
      })
      if (platforms.length !== 1) return

      const [only] = platforms
      await tx.userGamePlatform.update({
        where: {
          userGameId_platform_console: {
            userGameId,
            platform: only.platform,
            console: only.console
          }
        },
        data: {
          completions: Math.max(only.completions, 1),
          completedAt: only.completedAt ?? completedAt
        }
      })
      await this.recomputeTotals(tx, userGameId)
    })
  }

  private async lockAccount(
    tx: Prisma.TransactionClient,
    accountHours?: AccountHours
  ) {
    if (!accountHours) return true
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM xbox_accounts WHERE id = ${accountHours.accountId} FOR SHARE
    `
    return locked.length > 0
  }

  private async applyAccountHours(
    tx: Prisma.TransactionClient,
    userGamePlatformId: string,
    { accountId, hours }: AccountHours,
    accountExists: boolean
  ) {
    if (!accountExists) {
      await this.syncRowHours(tx, userGamePlatformId)
      return
    }
    await tx.xboxAccountHours.upsert({
      where: {
        userGamePlatformId_xboxAccountId: {
          userGamePlatformId,
          xboxAccountId: accountId
        }
      },
      update: { hoursPlayed: hours },
      create: { userGamePlatformId, xboxAccountId: accountId, hoursPlayed: hours }
    })
    await this.syncRowHours(tx, userGamePlatformId)
  }

  private async syncRowHours(
    tx: Prisma.TransactionClient,
    userGamePlatformId: string
  ) {
    const { _sum, _count } = await tx.xboxAccountHours.aggregate({
      where: { userGamePlatformId },
      _sum: { hoursPlayed: true },
      _count: true
    })
    await tx.userGamePlatform.update({
      where: { id: userGamePlatformId },
      data: { hoursPlayed: _count > 0 ? _sum.hoursPlayed : null }
    })
  }

  async removeXboxAccount(userId: string, accountId: string) {
    return prisma.$transaction(async tx => {
      const account = await tx.xboxAccount.findFirst({
        where: { id: accountId, userId },
        select: { id: true }
      })
      if (!account) return false

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM xbox_accounts WHERE id = ${accountId} FOR UPDATE
      `
      if (locked.length === 0) return false
      const affected = await tx.xboxAccountHours.findMany({
        where: { xboxAccountId: accountId },
        select: {
          userGamePlatformId: true,
          userGamePlatform: { select: { userGameId: true } }
        }
      })
      await tx.xboxAccount.delete({ where: { id: accountId } })

      for (const { userGamePlatformId } of affected) {
        await this.syncRowHours(tx, userGamePlatformId)
      }
      const userGameIds = new Set(
        affected.map(row => row.userGamePlatform.userGameId)
      )
      for (const userGameId of userGameIds) {
        await this.recomputeTotals(tx, userGameId)
      }
      return true
    }, { timeout: REMOVE_ACCOUNT_TIMEOUT_MS })
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
    } else if (completions === 0) {
      await tx.userGame.updateMany({
        where: { id: userGameId, completedAt: { not: null } },
        data: { completedAt: null }
      })
    }
  }
}
