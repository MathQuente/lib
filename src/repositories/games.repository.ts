import { Status } from '@prisma/client'
import { prisma } from '../database/db'
import { CreateGameDTO, UpdateGameDTO } from '../dtos/game.dto'

export class GameRepository {
  private async executeGameQuery(query: string) {
    const gameIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(query)

    if (gameIds.length === 0) {
      return []
    }

    const games = await prisma.game.findMany({
      where: {
        id: { in: gameIds.map(g => g.id) }
      },
      select: this.getSelectFields()
    })

    const gameMap = new Map(games.map(game => [game.id, game]))
    return gameIds.map(({ id }) => gameMap.get(id)).filter(Boolean)
  }

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
    query: string | undefined,
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
    query: string | undefined,
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
    query: string | undefined,
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
    query: string | undefined,
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
      gameBanner: true,
      gameName: true,
      isDlc: true,
      gameLaunchers: {
        select: {
          dateRelease: true,
          platformId: true,
          platforms: true
        }
      },
      platforms: {
        select: {
          id: true,
          platformName: true
        }
      },
      summary: true
    }
  }

  async findManyGamesByMostRating() {
    const query = `
      SELECT g.id
      FROM games g
      INNER JOIN ratings r ON g.id = r.game_id
      GROUP BY g.id
      HAVING COUNT(r.rating_id) > 0
      ORDER BY AVG(r.value) DESC, COUNT(r.rating_id) DESC
      LIMIT 6
    `

    return this.executeGameQuery(query)
  }

  async findManyGamesByTrending() {
    const query = `
     SELECT g.id
      FROM games g
      INNER JOIN user_games ug ON g.id = ug.game_id
      INNER JOIN users_games_status ugs ON ug.user_games_status_id = ugs.id
      WHERE ugs.status = 'PLAYING'
      GROUP BY g.id
      ORDER BY COUNT(DISTINCT ug.id) DESC
      LIMIT 6
    `

    return this.executeGameQuery(query)
  }

  async findManyGamesByRecentDate() {
    const query = `
    SELECT g.id
    FROM "games" g
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    WHERE gl."date_release" <= NOW()
      AND gl."date_release" IS NOT NULL
    GROUP BY g.id, g."game_name"
    ORDER BY MIN(gl."date_release") DESC
    LIMIT 6
      `

    return this.executeGameQuery(query)
  }

  async findManyGamesByFutureRelease(
    pageIndex: number = 0,
    itemsPerPage: number = 10,
    query?: string | null,
    sortBy: 'gameName' | 'dateRelease' | 'rating' = 'gameName',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const getSortClause = (sortBy: string, sortOrder: string): string => {
      switch (sortBy) {
        case 'gameName':
          return `g."game_name" ${sortOrder.toUpperCase()}`
        case 'dateRelease':
          return `next_release_date ${sortOrder.toUpperCase()}, g."game_name" ASC`
        case 'rating':
          return `avg_rating ${sortOrder.toUpperCase()}, g."game_name" ASC`
        default:
          return `g."game_name" ${sortOrder.toUpperCase()}`
      }
    }

    let gameIdsQuery: string
    let params: any[]

    if (query) {
      gameIdsQuery = `
      SELECT
        g.id,
        MIN(gl."date_release") as next_release_date,
        COALESCE(AVG(r.value), 0) as avg_rating
      FROM "games" g
      LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
      LEFT JOIN "ratings" r ON g.id = r."game_id"
      WHERE gl."date_release" > NOW()
        AND g."game_name" ILIKE $3
      GROUP BY g.id, g."game_name"
      ORDER BY ${getSortClause(sortBy, sortOrder)}
      OFFSET $1 LIMIT $2
    `
      params = [pageIndex * itemsPerPage, itemsPerPage, `%${query}%`]
    } else {
      gameIdsQuery = `
      SELECT
        g.id,
        MIN(gl."date_release") as next_release_date,
        COALESCE(AVG(r.value), 0) as avg_rating
      FROM "games" g
      LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
      LEFT JOIN "ratings" r ON g.id = r."game_id"
      WHERE gl."date_release" > NOW()
      GROUP BY g.id, g."game_name"
      ORDER BY ${getSortClause(sortBy, sortOrder)}
      OFFSET $1 LIMIT $2
    `
      params = [pageIndex * itemsPerPage, itemsPerPage]
    }

    const gameIds = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        next_release_date: Date
        avg_rating: number
      }>
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

  async countGames(query: string | undefined) {
    if (!query) {
      return prisma.game.count()
    }

    return prisma.game.count({
      where: {
        gameName: {
          contains: query,
          mode: 'insensitive'
        }
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
        gameName: true,
        gameBanner: true
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
        },
        Rating: {
          select: {
            value: true
          }
        },
        userGames: {
          select: {
            userId: true,
            UserGamesStatus: {
              select: {
                status: true
              }
            }
          }
        }
      }
    })
  }

  async findCategoriesOfGameById(
    gameId: string,
    samestudio: { id: string }[],
    categoryIds: number[]
  ) {
    return prisma.game.findMany({
      where: {
        id: { notIn: [gameId, ...samestudio.map(g => g.id)] },
        categories: { some: { id: { in: categoryIds } } }
      },
      select: {
        id: true,
        gameName: true,
        gameBanner: true
      },
      orderBy: {
        gameName: 'asc'
      },
      take: 8 - samestudio.length
    })
  }

  async findGamesFromSameStudio(gameId: string, studioIds: string[]) {
    return prisma.game.findMany({
      where: {
        id: { not: gameId },
        gameStudios: { some: { id: { in: studioIds } } }
      },
      select: {
        id: true,
        gameBanner: true,
        gameName: true
      },
      orderBy: { gameName: 'asc' },
      take: 8
    })
  }

  async findStatusByName(status: Status) {
    return prisma.userGamesStatus.findFirst({
      where: {
        status: status
      }
    })
  }

  async findSimilarGames(categories: { id: number }[], gameId?: string) {
    const categoryId = categories?.map(category => category.id)

    return prisma.game.findMany({
      where: {
        AND: [
          {
            id: { not: gameId }
          },
          {
            categories: {
              some: {
                id: { in: categoryId }
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
    return prisma.game.update({
      where: {
        id: gameId
      },
      data: {
        // Para relacionamentos many-to-many, você precisa desconectar os antigos primeiro
        categories: data.categories
          ? {
              set: [], // Remove todas as conexões existentes
              connectOrCreate: data.categories.map(category => ({
                create: {
                  categoryName: category.categoryName
                },
                where: {
                  categoryName: category.categoryName
                }
              }))
            }
          : undefined,

        gameStudios: data.gameStudios
          ? {
              set: [], // Remove todas as conexões existentes
              connectOrCreate: data.gameStudios.map(gameStudio => ({
                create: {
                  studioName: gameStudio.studioName
                },
                where: {
                  studioName: gameStudio.studioName
                }
              }))
            }
          : undefined,

        platforms: data.platforms
          ? {
              set: [], // Remove todas as conexões existentes
              connectOrCreate: data.platforms.map(platform => ({
                create: {
                  platformName: platform.platformName
                },
                where: {
                  platformName: platform.platformName
                }
              }))
            }
          : undefined,

        publishers: data.publishers
          ? {
              set: [], // Remove todas as conexões existentes
              connectOrCreate: data.publishers.map(publisher => ({
                create: {
                  publisherName: publisher.publisherName
                },
                where: {
                  publisherName: publisher.publisherName
                }
              }))
            }
          : undefined,

        // Campos simples
        gameBanner: data.gameBanner,
        gameName: data.gameName,
        summary: data.summary,
        isDlc: data.isDlc,
        parentGameId: data.parentGameId
      },
      select: {
        id: true,
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
        summary: true,
        isDlc: true,
        parentGameId: true
      }
    })
  }

  async findGamesToDisplay() {
    return prisma.game.findMany({
      select: {
        id: true,
        gameBanner: true,
        gameName: true,
        userGames: {
          select: {
            userId: true,
            UserGamesStatus: {
              select: {
                status: true
              }
            }
          }
        }
      }
    })
  }

  async countComingSoonGames(query?: string | null) {
    let countQuery: string
    let params: any[]

    if (query) {
      countQuery = `
      SELECT COUNT(DISTINCT g.id)::int as count
      FROM "games" g
      LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
      WHERE gl."date_release" > NOW()
        AND g."game_name" ILIKE $1
    `
      params = [`%${query}%`]
    } else {
      countQuery = `
      SELECT COUNT(DISTINCT g.id)::int as count
      FROM "games" g
      LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
      WHERE gl."date_release" > NOW()
    `
      params = []
    }

    const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      countQuery,
      ...params
    )

    return result[0]?.count || 0
  }
}
