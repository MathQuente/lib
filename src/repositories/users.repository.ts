import { Console, Platform, Prisma, Status } from '@prisma/client'
import { prisma } from '../database/db'
import { ClientError } from '../errors/client-error'
import { AddGameDTO, UpdateUserDTO } from '../dtos/user.dto'
import {
  PaginatedUserGameRow,
  UserGameSortBy,
  UserGameSortOrder
} from '../types/user'
import { PLAYED_STATUS_ID } from '../utils/library-status'

const NOT_WISHLIST = {
  UserGamesStatus: { status: { not: Status.WISHLIST } }
} satisfies Prisma.UserGameWhereInput

export class UserRepository {
  async addGameToUserLibrary(data: AddGameDTO) {
    const completedAt =
      data.statusIds === PLAYED_STATUS_ID
        ? (data.completedAt ?? new Date())
        : undefined

    return prisma.userGame.create({
      data: {
        igdbId: data.igdbId,
        userId: data.userId,
        userGamesStatusId: data.statusIds,
        completedAt,
        endless: data.endless ?? false
      },
      select: { igdbId: true }
    })
  }

  async createUserGameStats(
    userId: string,
    igdbId: number,
    completions: number = 0
  ) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: { id: true }
    })

    if (!userGame) {
      console.error('[UserGameStats] createUserGameStats: userGame not found', {
        userId,
        igdbId
      })
      return null
    }

    return prisma.userGameStats.upsert({
      where: { userGameId: userGame.id },
      update: { completions },
      create: { userGameId: userGame.id, completions },
      select: { completions: true }
    })
  }

  async upsertUserGameHours(
    userId: string,
    igdbId: number,
    hoursPlayed: number
  ) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: { id: true }
    })

    if (!userGame) {
      console.error('[UserGameStats] upsertUserGameHours: userGame not found', {
        userId,
        igdbId
      })
      return null
    }

    return prisma.userGameStats.upsert({
      where: { userGameId: userGame.id },
      update: { hoursPlayed },
      create: { userGameId: userGame.id, hoursPlayed },
      select: { hoursPlayed: true }
    })
  }

  async findUserGameHours(igdbId: number, userId: string) {
    const stats = await prisma.userGameStats.findFirst({
      where: { userGame: { userId, igdbId } },
      select: { hoursPlayed: true }
    })
    return { stats }
  }

  async findUserGameForCompletedAt(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: {
        completedAt: true,
        userGamesStatusId: true,
        _count: { select: { platforms: true } }
      }
    })
  }

  async updateUserGameCompletedAt(
    igdbId: number,
    userId: string,
    completedAt: Date
  ) {
    return prisma.userGame.update({
      where: { userId_igdbId: { userId, igdbId } },
      data: { completedAt },
      select: { completedAt: true }
    })
  }

  async findUserGameStatusesForGames(userId: string, igdbIds: number[]) {
    const statusMap = new Map<
      number,
      { status: string; completions: number; hoursPlayed: number }
    >()

    if (igdbIds.length === 0) return statusMap

    const rows = await prisma.userGame.findMany({
      where: { userId, igdbId: { in: igdbIds } },
      select: {
        igdbId: true,
        UserGamesStatus: { select: { status: true } },
        UserGameStats: { select: { completions: true, hoursPlayed: true } }
      }
    })

    for (const row of rows) {
      statusMap.set(row.igdbId, {
        status: row.UserGamesStatus.status,
        completions: row.UserGameStats?.completions ?? 0,
        hoursPlayed: row.UserGameStats?.hoursPlayed
          ? Number(row.UserGameStats.hoursPlayed)
          : 0
      })
    }

    return statusMap
  }

  async sumUserHoursPlayed(userId: string) {
    const result = await prisma.userGameStats.aggregate({
      where: { userGame: { userId } },
      _sum: { hoursPlayed: true }
    })
    return result._sum.hoursPlayed
  }

  async countUserGames(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { _count: { select: { userGames: { where: NOT_WISHLIST } } } }
    })
  }

  async deleteUser(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
      select: { id: true, userName: true }
    })
  }

  async findImageUrlsInUse(urls: string[]) {
    const rows = await prisma.user.findMany({
      where: {
        OR: [{ profilePicture: { in: urls } }, { userBanner: { in: urls } }]
      },
      select: { profilePicture: true, userBanner: true }
    })
    const inUse = new Set<string>()
    for (const row of rows) {
      if (row.profilePicture) inUse.add(row.profilePicture)
      if (row.userBanner) inUse.add(row.userBanner)
    }
    return urls.filter(url => inUse.has(url))
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        userBanner: true,
        userName: true,
        profilePicture: true,
        accounts: {
          select: {
            id: true,
            platform: true,
            externalId: true,
            displayName: true,
            preferredConsole: true
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: { select: { userGames: { where: NOT_WISHLIST } } }
      }
    })
  }

  async listAccounts(userId: string, platform: Platform) {
    return prisma.platformAccount.findMany({
      where: { userId, platform },
      select: {
        id: true,
        externalId: true,
        displayName: true,
        preferredConsole: true
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  async setAccountConsole(
    userId: string,
    accountId: string,
    platform: Platform,
    preferredConsole: Console | null
  ) {
    const { count } = await prisma.platformAccount.updateMany({
      where: { id: accountId, userId, platform },
      data: { preferredConsole }
    })
    return count > 0
  }

  async findAccount(platform: Platform, externalId: string) {
    return prisma.platformAccount.findUnique({
      where: { platform_externalId: { platform, externalId } },
      select: { id: true, userId: true, displayName: true }
    })
  }

  async addAccount(
    userId: string,
    platform: Platform,
    account: { externalId: string; displayName: string },
    maxAccounts?: number
  ) {
    const data = { userId, platform, ...account }
    const select = { id: true, displayName: true }
    if (maxAccounts === undefined) {
      return prisma.platformAccount.create({ data, select })
    }
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${platform.toLowerCase()}-accounts:${userId}`}))`
      const count = await tx.platformAccount.count({
        where: { userId, platform }
      })
      if (count >= maxAccounts) return null
      return tx.platformAccount.create({ data, select })
    })
  }

  async updateAccountName(accountId: string, displayName: string) {
    return prisma.platformAccount.update({
      where: { id: accountId },
      data: { displayName },
      select: { id: true, displayName: true }
    })
  }

  async findUserGameStatus(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { igdbId, userId } },
      select: {
        endless: true,
        UserGamesStatus: { select: { id: true, status: true } },
        UserGameStats: { select: { completions: true, hoursPlayed: true } },
        _count: { select: { platforms: true } }
      }
    })
  }

  async findUserGame(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { igdbId, userId } },
      select: {
        id: true,
        igdbId: true,
        endless: true,
        endlessLocked: true,
        UserGamesStatus: { select: { id: true } },
        _count: { select: { platforms: true } }
      }
    })
  }

  async findTrendingIgdbIds(
    limit: number,
    since: Date
  ): Promise<{ igdbId: number; playingCount: number }[]> {
    const results = await prisma.userGame.groupBy({
      by: ['igdbId'],
      where: {
        updatedAt: { gte: since },
        UserGamesStatus: { status: 'PLAYING' }
      },
      _count: { igdbId: true },
      orderBy: { _count: { igdbId: 'desc' } },
      take: limit
    })
    return results.map(r => ({
      igdbId: r.igdbId,
      playingCount: r._count.igdbId
    }))
  }

  async findManyGamesOfUser({
    userId,
    filter,
    query,
    sortBy,
    sortOrder = 'asc',
    skip,
    take,
    previewPerStatus,
    uncappedStatuses = []
  }: {
    userId: string
    filter?: Status
    query?: string
    sortBy?: UserGameSortBy
    sortOrder?: UserGameSortOrder
    skip?: number
    take?: number
    previewPerStatus?: number
    uncappedStatuses?: Status[]
  }): Promise<PaginatedUserGameRow[]> {
    const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`

    const orderByClause =
      sortBy === 'gameName'
        ? Prisma.sql`gc.name ${direction} NULLS LAST`
        : sortBy === 'dateRelease'
          ? Prisma.sql`COALESCE(gc.release_date, 0) ${direction}`
          : sortBy === 'rating'
            ? Prisma.sql`COALESCE(r.value, -1) ${direction}`
            : sortBy === 'hoursPlayed'
              ? Prisma.sql`COALESCE(ugst.hours_played, 0) ${direction}`
              : sortBy === 'completedAt'
                ? Prisma.sql`COALESCE(ug.completed_at, ug.updated_at) ${direction}`
                : Prisma.sql`ug.updated_at ${direction}`

    const statusFilter = filter
      ? Prisma.sql`AND ugs.status = ${filter}::"Status"`
      : Prisma.empty

    const queryFilter = query
      ? Prisma.sql`AND gc.name ILIKE ${`%${query}%`}`
      : Prisma.empty

    const limitClause =
      take !== undefined
        ? Prisma.sql`LIMIT ${take} OFFSET ${skip ?? 0}`
        : Prisma.empty

    const ranked = previewPerStatus !== undefined && take === undefined
    const rowNumber = ranked
      ? Prisma.sql`ROW_NUMBER() OVER (PARTITION BY ugs.status ORDER BY ${orderByClause}, ug.id) AS rn,`
      : Prisma.empty

    const rows = Prisma.sql`
      SELECT
        ${rowNumber}
        ug.igdb_id                    AS "igdbId",
        ugs.status                    AS "status",
        ug.endless                    AS "endless",
        gc.name                       AS "name",
        gc.cover_url                  AS "coverUrl",
        gc.platforms                  AS "platforms",
        gc.release_date               AS "releaseDate",
        r.value                       AS "rating",
        COALESCE(ugst.completions, 0) AS "completions",
        COALESCE(ugst.hours_played, 0)::float AS "hoursPlayed",
        COALESCE(
          (SELECT array_agg(p.platform::text ORDER BY p.platform)
           FROM (
             SELECT DISTINCT ugp.platform
             FROM user_game_platforms ugp
             WHERE ugp.user_game_id = ug.id
           ) p),
          '{}'
        )                             AS "playedOn"
      FROM user_games ug
      JOIN users_games_status ugs ON ugs.id = ug.user_games_status_id
      LEFT JOIN games_cache gc ON gc.igdb_id = ug.igdb_id
      LEFT JOIN ratings r ON r.igdb_id = ug.igdb_id AND r.user_id = ${userId}
      LEFT JOIN user_game_stats ugst ON ugst.user_game_id = ug.id
      WHERE ug.user_id = ${userId}
      ${statusFilter}
      ${queryFilter}
      ORDER BY ${orderByClause}, ug.id
      ${limitClause}
    `

    if (!ranked) {
      return prisma.$queryRaw<PaginatedUserGameRow[]>(rows)
    }

    const uncapped =
      uncappedStatuses.length > 0
        ? Prisma.sql` OR ranked."status"::text IN (${Prisma.join(uncappedStatuses)})`
        : Prisma.empty

    return prisma.$queryRaw<PaginatedUserGameRow[]>(Prisma.sql`
      SELECT
        ranked."igdbId", ranked."status", ranked."endless", ranked."name",
        ranked."coverUrl", ranked."platforms", ranked."releaseDate",
        ranked."rating", ranked."completions", ranked."hoursPlayed",
        ranked."playedOn"
      FROM (${rows}) ranked
      WHERE ranked.rn <= ${previewPerStatus}${uncapped}
      ORDER BY ranked.rn
    `)
  }

  async findLibraryIgdbIds(userId: string) {
    const rows = await prisma.userGame.findMany({
      where: { userId },
      select: { igdbId: true }
    })
    return rows.map(row => row.igdbId)
  }

  async findGamesCountByStatus(userId: string) {
    const totals = await prisma.userGamesStatus.findMany({
      select: {
        id: true,
        status: true,
        _count: { select: { userGames: { where: { userId } } } }
      }
    })
    return totals
  }

  async findManyUsers({ pageIndex = 0, limit = 18, query = '' } = {}) {
    return prisma.user.findMany({
      where: {
        userName: query ? { contains: query } : undefined
      },
      orderBy: [{ userName: 'asc' }],
      skip: pageIndex * limit,
      take: limit,
      select: {
        id: true,
        profilePicture: true,
        userBanner: true,
        userName: true,
        _count: { select: { userGames: { where: NOT_WISHLIST } } }
      }
    })
  }

  async setEndless(igdbId: number, userId: string, endless: boolean) {
    return prisma.userGame.update({
      where: { userId_igdbId: { igdbId, userId } },
      data: { endless, endlessLocked: true },
      select: { igdbId: true, endless: true }
    })
  }

  async removeGame(igdbId: number, userId: string) {
    return prisma.userGame.delete({
      where: { userId_igdbId: { igdbId, userId } },
      select: { igdbId: true }
    })
  }

  async ensureAtLeastOneCompletion(userId: string, igdbId: number) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: { id: true }
    })

    if (!userGame) {
      console.error(
        '[UserGameStats] ensureAtLeastOneCompletion: userGame not found',
        { userId, igdbId }
      )
      return null
    }

    await prisma.userGameStats.updateMany({
      where: { userGameId: userGame.id, completions: { lt: 1 } },
      data: { completions: 1 }
    })

    return prisma.userGameStats.upsert({
      where: { userGameId: userGame.id },
      update: {},
      create: { userGameId: userGame.id, completions: 1 },
      select: { completions: true }
    })
  }

  async updateGameStatus(
    igdbId: number,
    userId: string,
    statusId: number,
    options: { endless?: boolean } = {}
  ) {
    return prisma.userGame.update({
      where: { userId_igdbId: { igdbId, userId } },
      data: {
        userGamesStatusId: statusId,
        endless: options.endless,
        updatedAt: new Date(),
        completedAt: statusId === PLAYED_STATUS_ID ? new Date() : undefined
      },
      select: {
        igdbId: true,
        UserGamesStatus: { select: { id: true, status: true } }
      }
    })
  }

  async moveToWishlist(igdbId: number, userId: string, statusId: number) {
    return prisma.$transaction(async tx => {
      const userGame = await tx.userGame.findUnique({
        where: { userId_igdbId: { igdbId, userId } },
        select: { id: true }
      })
      if (!userGame) {
        throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
      }
      const userGameId = userGame.id

      await tx.rating.deleteMany({ where: { userId, igdbId } })
      await tx.completionSuggestion.deleteMany({ where: { userGameId } })
      await tx.userGamePlatform.deleteMany({ where: { userGameId } })
      await tx.userGameStats.upsert({
        where: { userGameId },
        update: { completions: 0, hoursPlayed: null },
        create: { userGameId, completions: 0, hoursPlayed: null }
      })

      return tx.userGame.update({
        where: { id: userGameId },
        data: {
          userGamesStatusId: statusId,
          completedAt: null,
          updatedAt: new Date()
        },
        select: {
          igdbId: true,
          UserGamesStatus: { select: { id: true, status: true } }
        }
      })
    })
  }

  async updateUser(userId: string, data: UpdateUserDTO) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        profilePicture: true,
        userBanner: true,
        userName: true
      }
    })
  }

  async findUserGameStats(igdbId: number, userId: string) {
    const stats = await prisma.userGameStats.findFirst({
      where: { userGame: { userId, igdbId } },
      select: { completions: true }
    })
    return { stats }
  }

  async updateUserGamePlayedCount(
    userId: string,
    igdbId: number,
    incrementValue: number
  ) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: { id: true }
    })

    if (!userGame) {
      console.error(
        '[UserGameStats] updateUserGamePlayedCount: userGame not found',
        { userId, igdbId }
      )
      return null
    }

    return prisma.userGameStats.update({
      where: { userGameId: userGame.id },
      data: { completions: { increment: incrementValue } },
      select: { completions: true }
    })
  }
}
