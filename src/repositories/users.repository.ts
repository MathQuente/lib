import { Status } from '@prisma/client'
import { prisma } from '../database/db'
import { AddGameDTO, UpdateUserDTO } from '../dtos/user.dto'

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

    if (!userGame) return null

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

  async findManyByIds(statusIds: number) {
    return prisma.userGamesStatus.findMany({ where: { id: statusIds } })
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

  async findTrendingIgdbIds(limit: number, since: Date): Promise<{ igdbId: number; playingCount: number }[]> {
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
    return results.map(r => ({ igdbId: r.igdbId, playingCount: r._count.igdbId }))
  }

  async findManyGamesOfUser(userId: string, filterStatus?: Status | string) {
    return prisma.userGame.findMany({
      where: {
        userId,
        ...(filterStatus
          ? { UserGamesStatus: { status: filterStatus as Status } }
          : {})
      },
      select: {
        igdbId: true,
        UserGamesStatus: { select: { id: true, status: true } }
      }
    })
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

    if (!userGame) throw new Error('UserGame not found.')

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

    if (!userGame) throw new Error('UserGame not found.')

    return prisma.userGameStats.update({
      where: { userGameId: userGame.id },
      data: { completions: { increment: incrementValue } },
      select: { completions: true }
    })
  }
}
