import { prisma } from '../database/db'

export class UserGamesStatusRepository {
  async findManyGameStatus() {
    return prisma.userGamesStatus.findMany({
      select: {
        id: true,
        status: true
      }
    })
  }
}
