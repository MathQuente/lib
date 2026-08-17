import { Prisma, Status } from '@prisma/client'
import { prisma } from '../database/db'
import { AddGameDTO, UpdateUserDTO } from '../dtos/user.dto'
import {
  PaginatedUserGameRow,
  UserGameSortBy,
  UserGameSortOrder
} from '../types/user'

export class UserRepository {
  async addGameToUserLibrary(data: AddGameDTO) {
    return prisma.userGame.create({
      data: {
        igdbId: data.igdbId,
        userId: data.userId,
        userGamesStatusId: data.statusIds
      },
      select: { igdbId: true }
    })
  }

  async createUserGameStats(
    userId: string,
    igdbId: number,
    completions: number = 1
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

  async countUserGames(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { _count: { select: { userGames: true } } }
    })
  }

  async deleteUser(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
      select: { id: true, userName: true }
    })
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userBanner: true,
        userName: true,
        profilePicture: true,
        _count: { select: { userGames: true } }
      }
    })
  }

  async findUserGameStatus(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { igdbId, userId } },
      select: {
        UserGamesStatus: { select: { id: true, status: true } }
      }
    })
  }

  async findUserGame(igdbId: number, userId: string) {
    return prisma.userGame.findUnique({
      where: { userId_igdbId: { igdbId, userId } },
      select: {
        igdbId: true,
        UserGamesStatus: { select: { id: true } }
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
    take
  }: {
    userId: string
    filter?: Status
    query?: string
    sortBy?: UserGameSortBy
    sortOrder?: UserGameSortOrder
    skip?: number
    take?: number
  }): Promise<PaginatedUserGameRow[]> {
    const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`

    const orderByClause =
      sortBy === 'gameName'
        ? Prisma.sql`gc.name ${direction} NULLS LAST`
        : sortBy === 'dateRelease'
          ? Prisma.sql`COALESCE(gc.release_date, 0) ${direction}`
          : sortBy === 'rating'
            ? Prisma.sql`COALESCE(r.avg_rating, -1) ${direction}`
            : Prisma.sql`ug.created_at ASC`

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

    return prisma.$queryRaw<PaginatedUserGameRow[]>(Prisma.sql`
      SELECT
        ug.igdb_id       AS "igdbId",
        ugs.status       AS "status",
        gc.name          AS "name",
        gc.cover_url     AS "coverUrl",
        gc.platforms     AS "platforms",
        gc.release_date  AS "releaseDate",
        r.avg_rating     AS "rating"
      FROM user_games ug
      JOIN users_games_status ugs ON ugs.id = ug.user_games_status_id
      LEFT JOIN games_cache gc ON gc.igdb_id = ug.igdb_id
      LEFT JOIN (
        SELECT igdb_id, AVG(value) AS avg_rating
        FROM ratings
        WHERE igdb_id IN (SELECT igdb_id FROM user_games WHERE user_id = ${userId})
        GROUP BY igdb_id
      ) r ON r.igdb_id = ug.igdb_id
      WHERE ug.user_id = ${userId}
      ${statusFilter}
      ${queryFilter}
      ORDER BY ${orderByClause}
      ${limitClause}
    `)
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
        _count: { select: { userGames: true } }
      }
    })
  }

  async removeGame(igdbId: number, userId: string) {
    return prisma.userGame.delete({
      where: { userId_igdbId: { igdbId, userId } },
      select: { igdbId: true }
    })
  }

  async removeUserGameStats(userId: string, igdbId: number) {
    const userGame = await prisma.userGame.findUnique({
      where: { userId_igdbId: { userId, igdbId } },
      select: { id: true }
    })

    if (!userGame) {
      console.error('[UserGameStats] removeUserGameStats: userGame not found', {
        userId,
        igdbId
      })
      return null
    }

    return prisma.userGameStats.delete({
      where: { userGameId: userGame.id },
      select: { completions: true }
    })
  }

  async updateGameStatus(igdbId: number, userId: string, statusId: number) {
    return prisma.userGame.update({
      where: { userId_igdbId: { igdbId, userId } },
      data: { userGamesStatusId: statusId, updatedAt: new Date() },
      select: {
        igdbId: true,
        UserGamesStatus: { select: { id: true, status: true } }
      }
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
