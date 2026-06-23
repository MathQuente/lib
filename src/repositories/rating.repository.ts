import { prisma } from '../database/db'

export class RatingRepository {
  async create(igdbId: number, value: number, userId: string) {
    return prisma.rating.upsert({
      where: { userId_igdbId: { userId, igdbId } },
      update: { value, updatedAt: new Date() },
      create: { userId, igdbId, value },
      select: { value: true }
    })
  }

  async delete(igdbId: number, userId: string) {
    return prisma.rating.delete({
      where: { userId_igdbId: { userId, igdbId } }
    })
  }

  async findUniqueByUserGame(igdbId: number, userId: string) {
    return prisma.rating.findUnique({
      where: { userId_igdbId: { igdbId, userId } },
      select: { value: true }
    })
  }

  async findAverageRatingOfGame(igdbId: number) {
    return prisma.rating.aggregate({
      where: { igdbId },
      _avg: { value: true }
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

  async countRatingByName(igdbId: number) {
    return prisma.rating.count({
      where: { igdbId },
      select: { value: true }
    })
  }

  async findRatingDistribution(igdbId: number) {
    return prisma.rating.groupBy({
      by: ['value'],
      where: { igdbId },
      _count: { value: true },
      orderBy: { value: 'asc' }
    })
  }

  async getAverageRatingsForGames(igdbIds: number[]): Promise<Map<number, number | null>> {
    if (igdbIds.length === 0) return new Map()
    const results = await prisma.rating.groupBy({
      by: ['igdbId'],
      where: { igdbId: { in: igdbIds } },
      _avg: { value: true }
    })
    const map = new Map<number, number | null>()
    for (const r of results) {
      map.set(r.igdbId, r._avg.value)
    }
    return map
  }
}
