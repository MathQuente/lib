import { prisma } from '../database/db'

export class RatingRepository {
  async create(gameId: string, value: number, userId: string) {
    return prisma.rating.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: { value, updatedAt: new Date() },
      create: { userId, gameId, value },
      select: {
        value: true
      }
    })
  }

  async delete(gameId: string, userId: string) {
    return prisma.rating.delete({
      where: { userId_gameId: { userId, gameId } }
    })
  }

  async findUniqueByUserGame(gameId: string, userId: string) {
    return prisma.rating.findUnique({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      select: {
        value: true
      }
    })
  }

  async findAverageRatingOfGame(gameId: string) {
    return prisma.rating.aggregate({
      where: {
        gameId
      },
      _avg: {
        value: true
      }
    })
  }

  async findRating(gameId: string) {
    return prisma.rating.findFirstOrThrow({
      where: {
        gameId
      },
      select: {
        value: true
      }
    })
  }

  async findManyRating() {
    return prisma.rating.findMany({
      select: {
        user: {
          select: {
            id: true,
            userName: true,
            profilePicture: true
          }
        },
        value: true
      }
    })
  }
}
