import { prisma } from '../database/db'

export class ReviewRepository {
  async findByUserGame(igdbId: number, userId: string) {
    return prisma.review.findUnique({
      where: { userId_igdbId: { userId, igdbId } }
    })
  }

  async upsert(userId: string, igdbId: number, text: string) {
    return prisma.review.upsert({
      where: { userId_igdbId: { userId, igdbId } },
      update: { text },
      create: { userId, igdbId, text }
    })
  }

  async delete(userId: string, igdbId: number) {
    return prisma.review.delete({
      where: { userId_igdbId: { userId, igdbId } }
    })
  }
}
