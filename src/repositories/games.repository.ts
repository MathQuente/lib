import { prisma } from '../database/db'
import { CreateGameDTO, UpdateGameDTO } from '../dtos/game.dto'

export class GameRepository {
  async create(data: CreateGameDTO) {
    const {
      categories,
      gameBanner,
      gameName,
      gameStudios,
      platforms,
      publishers,
      summary,
      isDlc,
      parentGameId
    } = data
    return prisma.game.create({
      data: {
        gameName,
        gameBanner,
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
        },
        isDlc,
        parentGameId
      },
      select: {
        id: true,
        gameName: true
      }
    })
  }

  async createGameDateRelease(
    gameId: string,
    dateRelease: Date,
    platformId: string
  ) {
    return await prisma.gameLauncher.create({
      data: {
        dateRelease,
        gameId,
        platformId
      },
      select: {
        dateRelease: true,
        platforms: {
          select: {
            id: true,
            platformName: true
          }
        }
      }
    })
  }

  async delete(gameId: string) {
    return prisma.game.delete({
      where: {
        id: gameId
      },
      select: {
        id: true,
        gameName: true
      }
    })
  }

  async findManyGames(
    pageIndex: number,
    itemsPerPage: number,
    query: string | null
  ) {
    return prisma.game.findMany({
      where: {
        gameName: query
          ? {
              contains: query
            }
          : undefined
      },
      skip: pageIndex * itemsPerPage,
      take: itemsPerPage,
      orderBy: [
        {
          gameName: 'asc'
        }
      ],
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
        gameBanner: true,
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
            platforms: {
              select: {
                id: true,
                platformName: true
              }
            }
          }
        },
        gameName: true,
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
        isDlc: true,
        parentGame: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        },
        dlcs: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        }
      }
    })
  }

  async countGames(query: string | null) {
    return prisma.game.count({
      where: {
        gameName: query
          ? {
              contains: query
            }
          : undefined
      }
    })
  }

  async findManyGameStatus() {
    return prisma.userGamesStatus.findMany({
      select: {
        id: true,
        status: true
      }
    })
  }

  async findByName(gameName: string) {
    return prisma.game.findUnique({
      where: {
        gameName
      },
      select: {
        id: true,
        gameName: true
      }
    })
  }

  async findById(gameId: string) {
    return prisma.game.findUnique({
      where: {
        id: gameId
      },
      select: {
        id: true,
        categories: {
          select: {
            id: true,
            categoryName: true
          }
        },
        gameBanner: true,
        gameName: true,
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
        summary: true,
        isDlc: true,
        parentGame: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        },
        dlcs: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        }
      }
    })
  }

  async findCategoriesOfGameById(gameId: string) {
    return prisma.game.findUnique({
      where: {
        id: gameId
      },
      select: {
        categories: {
          select: {
            id: true
          },
          orderBy: [
            {
              categoryName: 'asc'
            }
          ]
        }
      }
    })
  }

  async findDateRelease(gameId: string, platformId: string) {
    return prisma.gameLauncher.findUnique({
      where: {
        platformId_gameId: {
          gameId,
          platformId
        }
      }
    })
  }

  async findSimilarGames(categories: { id: number }[], gameId?: string) {
    const categoryId = categories?.map(category => category.id)

    return prisma.game.findMany({
      where: {
        AND: [
          {
            id: gameId ? { not: gameId } : undefined
          },
          {
            categories: {
              some: {
                id: categoryId.length > 0 ? { in: categoryId } : undefined
              }
            }
          }
        ]
      },
      select: {
        id: true,
        gameName: true,
        gameBanner: true
      },
      take: 8,
      orderBy: [
        {
          gameName: 'asc'
        }
      ]
    })
  }

  async update(gameId: string, data: UpdateGameDTO) {
    let updateData: Partial<UpdateGameDTO> = {}

    if (data.gameBanner) {
      updateData.gameBanner = data.gameBanner
    }

    if (data.gameStudios) {
      updateData.gameStudios = data.gameStudios
    }

    if (data.gameName) {
      updateData.gameName = data.gameName
    }

    if (data.categories) {
      updateData.categories = data.categories
    }

    if (data.platforms) {
      updateData.platforms = data.platforms
    }

    if (data.publishers) {
      updateData.publishers = data.publishers
    }

    if (data.summary) {
      updateData.summary = data.summary
    }

    if (data.isDlc) {
      updateData.isDlc = data.isDlc
    }

    if (data.parentGameId) {
      updateData.parentGameId = data.parentGameId
    }

    return prisma.game.update({
      where: {
        id: gameId
      },
      data: {
        categories: {
          connectOrCreate: updateData.categories?.map(category => ({
            create: {
              categoryName: category.categoryName
            },
            where: {
              categoryName: category.categoryName
            }
          }))
        },
        gameBanner: updateData.gameBanner,
        gameName: updateData.gameName,
        gameStudios: {
          connectOrCreate: updateData.gameStudios?.map(gameStudio => ({
            create: {
              studioName: gameStudio.studioName
            },
            where: {
              studioName: gameStudio.studioName
            }
          }))
        },
        platforms: {
          connectOrCreate: updateData.platforms?.map(platform => ({
            create: {
              platformName: platform.platformName
            },
            where: {
              platformName: platform.platformName
            }
          }))
        },
        publishers: {
          connectOrCreate: updateData.publishers?.map(publisher => ({
            create: {
              publisherName: publisher.publisherName
            },
            where: {
              publisherName: publisher.publisherName
            }
          }))
        },
        summary: updateData.summary,
        isDlc: data.isDlc,
        parentGameId: data.parentGameId
      },
      select: {
        categories: {
          select: {
            categoryName: true
          }
        },
        gameBanner: true,
        gameName: true,
        gameStudios: {
          select: {
            studioName: true
          }
        },
        platforms: {
          select: {
            platformName: true
          }
        },
        publishers: {
          select: {
            publisherName: true
          }
        },
        summary: true
      }
    })
  }
}
