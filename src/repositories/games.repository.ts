import { Status } from '@prisma/client'
import { prisma } from '../database/db'
import { CreateGameDTO, UpdateGameDTO } from '../dtos/game.dto'
import { boolean } from 'zod'

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
    query: string | null,
    sortBy: 'gameName' | 'dateRelease' | 'rating',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    if (sortBy === 'dateRelease') {
      return this.findManyGamesByDate(pageIndex, itemsPerPage, query, sortOrder)
    }
    if (sortBy === 'rating') {
      return this.findManyGamesByRating(
        pageIndex,
        itemsPerPage,
        query,
        sortOrder
      )
    } else {
      return this.findManyGamesByName(pageIndex, itemsPerPage, query, sortOrder)
    }
  }

  private async findManyGamesByName(
    pageIndex: number,
    itemsPerPage: number,
    query: string | null,
    sortOrder: 'asc' | 'desc'
  ) {
    return prisma.game.findMany({
      where: {
        gameName: query ? { contains: query, mode: 'insensitive' } : undefined
      },
      skip: pageIndex * itemsPerPage,
      take: itemsPerPage,
      orderBy: [{ gameName: sortOrder }],
      select: this.getSelectFields()
    })
  }

  private async findManyGamesByDate(
    pageIndex: number,
    itemsPerPage: number,
    query: string | null,
    sortOrder: 'asc' | 'desc'
  ) {
    const gameIdsQuery = `
    SELECT g.id
    FROM "games" g
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    WHERE 1=1
      ${query ? `AND g."game_name" ILIKE $4` : ''}
    GROUP BY g.id, g."game_name"
    ORDER BY
      CASE WHEN MIN(gl."date_release") IS NULL THEN 1 ELSE 0 END,
      MIN(gl."date_release") ${sortOrder.toUpperCase()},
      g."game_name" ASC
    OFFSET $1 LIMIT $2 
      `

    const params = query
      ? [pageIndex * itemsPerPage, itemsPerPage, sortOrder, `%${query}%`]
      : [pageIndex * itemsPerPage, itemsPerPage, sortOrder]

    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      gameIdsQuery,
      ...params
    )

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => {
        return games.find(game => game.id === id)
      })
      .filter(Boolean)
  }

  private async findManyGamesByRating(
    pageIndex: number,
    itemsPerPage: number,
    query: string | null,
    sortOrder: 'asc' | 'desc'
  ) {
    let gameIdsQuery: string
    let params: any[]

    if (query) {
      gameIdsQuery = `
      SELECT 
        g.id,
        COALESCE(AVG(r.value), 0) as avg_rating
      FROM "games" g
      LEFT JOIN "ratings" r ON g.id = r."game_id"
      WHERE g."game_name" ILIKE $4
      GROUP BY g.id, g."game_name"
      ORDER BY
        avg_rating ${sortOrder.toUpperCase()},
        g."game_name" ASC
      OFFSET $1 LIMIT $2
    `
      params = [pageIndex * itemsPerPage, itemsPerPage, sortOrder, `%${query}%`]
    } else {
      gameIdsQuery = `
      SELECT 
        g.id,
        COALESCE(AVG(r.value), 0) as avg_rating
      FROM "games" g
      LEFT JOIN "ratings" r ON g.id = r."game_id"
      GROUP BY g.id, g."game_name"
      ORDER BY
        avg_rating ${sortOrder.toUpperCase()},
        g."game_name" ASC
      OFFSET $1 LIMIT $2
    `
      params = [pageIndex * itemsPerPage, itemsPerPage]
    }

    const gameIds = await prisma.$queryRawUnsafe<
      Array<{ id: string; avg_rating: number }>
    >(gameIdsQuery, ...params)

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => {
        return games.find(game => game.id === id)
      })
      .filter(Boolean)
  }

  private getSelectFields() {
    return {
      id: true,
      categories: {
        orderBy: [{ categoryName: 'asc' as const }],
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
              platformName: 'asc' as const
            }
          }
        ],
        select: {
          dateRelease: true,
          releasePeriod: true,
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
        orderBy: [{ studioName: 'asc' as const }],
        select: {
          id: true,
          studioName: true
        }
      },
      platforms: {
        orderBy: [{ platformName: 'asc' as const }],
        select: {
          id: true,
          platformName: true
        }
      },
      publishers: {
        orderBy: [{ publisherName: 'asc' as const }],
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
  }

  async findManyGamesByMostBeated() {
    const gameIdsQuery = `
    SELECT
    g.id,
    COUNT(DISTINCT ug.id) as beated_count
    FROM "games" g
    INNER JOIN "user_games" ug ON g.id = ug."game_id"
    INNER JOIN "users_games_status" ugs ON ug."user_games_status_id" = ugs.id
    WHERE ugs.status = 'PLAYED'
    GROUP BY g.id
    ORDER BY beated_count DESC
    LIMIT 6
    `

    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      gameIdsQuery
    )

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => games.find(game => game.id === id))
      .filter(Boolean)
  }

  async findManyGamesByTrending() {
    const gameIdsQuery = `
    SELECT
    g.id,
    COUNT(DISTINCT ug.id) as playing_count
    FROM "games" g
    INNER JOIN "user_games" ug ON g.id = ug."game_id"
    INNER JOIN "users_games_status" ugs ON ug."user_games_status_id" = ugs.id
    WHERE ugs.status = 'PLAYING'
    GROUP BY g.id
    ORDER BY playing_count DESC
    LIMIT 6
    `

    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      gameIdsQuery
    )

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => games.find(game => game.id === id))
      .filter(Boolean)
  }

  async findManyGamesByRecentDate() {
    const gameIdsQuery = `
    SELECT g.id
    FROM "games" g
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    WHERE gl."date_release" <= NOW()
      AND gl."date_release" IS NOT NULL
    GROUP BY g.id, g."game_name"
    ORDER BY MIN(gl."date_release") DESC
    LIMIT 6
      `

    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      gameIdsQuery
    )

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => {
        return games.find(game => game.id === id)
      })
      .filter(Boolean)
  }

  async findManyGamesByFutureRelease() {
    const gameIdsQuery = `
    SELECT g.id
    FROM "games" g
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    WHERE gl."date_release" > NOW()
    GROUP BY g.id, g."game_name"
    ORDER BY MIN(gl."date_release") ASC
    LIMIT 6
      `

    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      gameIdsQuery
    )

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: {
          in: gameIds.map(g => g.id)
        }
      },
      select: this.getSelectFields()
    })

    return gameIds
      .map(({ id }) => games.find(game => game.id === id))
      .filter(Boolean)
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

  async findStatusByName(status: Status) {
    return prisma.userGamesStatus.findFirst({
      where: {
        status: status
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
