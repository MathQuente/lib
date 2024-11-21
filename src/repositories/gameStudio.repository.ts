import { prisma } from '../database/db'

export class GameStudioRepository {
  async findByName(studioName: string) {
    return prisma.gameStudio.findUnique({
      where: {
        studioName
      }
    })
  }

  async findById(gameStudioId: string, { pageIndex = 0, limit = 14 } = {}) {
    return prisma.gameStudio.findUnique({
      where: {
        id: gameStudioId
      },
      select: {
        id: true,
        studioName: true,
        games: {
          orderBy: [
            {
              gameName: 'asc'
            }
          ],
          skip: pageIndex * limit,
          take: limit,
          select: {
            id: true,
            gameBanner: true
          }
        },
        dlcs: {
          orderBy: [
            {
              dlcName: 'asc'
            }
          ],
          skip: (pageIndex || 0) * (limit || 0),
          take: limit,
          select: {
            id: true,
            dlcBanner: true
          }
        },
        _count: {
          select: {
            games: true,
            dlcs: true
          }
        }
      }
    })
  }

  async create(studioName: string) {
    return prisma.gameStudio.create({
      data: {
        studioName
      },
      select: {
        id: true
      }
    })
  }

  async findAllStudios({ pageIndex = 0, limit = 14 } = {}) {
    return prisma.gameStudio.findMany({
      orderBy: [
        {
          studioName: 'asc'
        }
      ],
      skip: pageIndex * limit,
      take: limit,
      select: {
        id: true,
        studioName: true,
        _count: {
          select: {
            games: true,
            dlcs: true
          }
        }
      }
    })
  }

  async update(gameStudioId: string, studioName: string) {
    return prisma.gameStudio.update({
      where: {
        id: gameStudioId
      },
      data: {
        studioName
      },
      select: {
        id: true,
        studioName: true
      }
    })
  }

  async delete(gameStudioId: string) {
    return prisma.gameStudio.delete({
      where: {
        id: gameStudioId
      },
      select: {
        id: true,
        studioName: true
      }
    })
  }
}
