import { prisma } from '../database/db'
import { CreateDlcDTO } from '../dtos/dlcs.dto'

export class DlcRepository {
  async createDlc(gameId: string, data: CreateDlcDTO) {
    const {
      categories,
      dlcBanner,
      dlcName,
      gameStudios,
      platforms,
      publishers,
      summary
    } = data
    return prisma.dLC.create({
      data: {
        dlcBanner,
        dlcName,
        gameId,
        summary,
        gameStudios: {
          connectOrCreate: gameStudios.map(({ studioName }) => ({
            where: { studioName },
            create: { studioName }
          }))
        },
        categories: {
          connectOrCreate: categories.map(({ categoryName }) => ({
            where: { categoryName },
            create: { categoryName }
          }))
        },
        platforms: {
          connectOrCreate: platforms.map(({ platformName }) => ({
            where: { platformName },
            create: { platformName }
          }))
        },
        publishers: {
          connectOrCreate: publishers.map(({ publisherName }) => ({
            where: { publisherName },
            create: { publisherName }
          }))
        }
      },
      select: {
        id: true,
        dlcName: true
      }
    })
  }

  async findDlcByName(dlcName: string) {
    return prisma.dLC.findUnique({
      where: {
        dlcName
      },
      select: {
        id: true,
        dlcName: true
      }
    })
  }

  async findManyDlcs({ pageIndex = 0, limit = 18 } = {}) {
    return prisma.dLC.findMany({
      orderBy: [
        {
          dlcName: 'asc'
        }
      ],
      skip: pageIndex * limit,
      take: limit,
      select: {
        id: true,
        categories: {
          orderBy: [
            {
              categoryName: 'asc'
            }
          ],
          select: {
            id: true,
            categoryName: true
          }
        },
        dlcBanner: true,
        dlcName: true,
        gameLaunchers: {
          orderBy: [
            {
              dateRelease: 'asc'
            }
          ],
          select: {
            dateRelease: true,
            platforms: {
              select: {
                id: true,
                platformName: true
              }
            }
          }
        },
        game: {
          select: {
            id: true,
            gameName: true,
            gameBanner: true
          }
        },
        gameStudios: {
          select: {
            id: true,
            studioName: true
          }
        },
        platforms: {
          orderBy: [
            {
              platformName: 'asc'
            }
          ],
          select: {
            id: true,
            platformName: true
          }
        },
        publishers: {
          orderBy: [
            {
              publisherName: 'asc'
            }
          ],
          select: {
            id: true,
            publisherName: true
          }
        },
        summary: true,
        _count: true
      }
    })
  }

  async findDlcById(dlcId: string) {
    return prisma.dLC.findUnique({
      where: {
        id: dlcId
      },
      select: {
        id: true,
        dlcBanner: true,
        dlcName: true,
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        },
        categories: {
          orderBy: [
            {
              categoryName: 'asc'
            }
          ],
          select: {
            id: true,
            categoryName: true
          }
        },
        gameStudios: {
          orderBy: [
            {
              studioName: 'asc'
            }
          ],
          select: {
            id: true,
            studioName: true
          }
        },
        gameLaunchers: {
          orderBy: [
            {
              platforms: {
                platformName: 'asc'
              }
            }
          ],
          select: {
            dateRelease: true,
            platformId: true,
            platforms: true
          }
        },
        platforms: {
          orderBy: [
            {
              platformName: 'asc'
            }
          ],
          select: {
            id: true,
            platformName: true
          }
        },
        publishers: {
          orderBy: [
            {
              publisherName: 'asc'
            }
          ],
          select: {
            id: true,
            publisherName: true
          }
        },
        summary: true
      }
    })
  }
}
