import { Status } from '@prisma/client'
import { prisma } from '../database/db'
import { AddGameDTO, UpdateUserDTO } from '../dtos/user.dto'

export class UserRepository {
  async addGameToUserLibrary(data: AddGameDTO) {
    return prisma.userGame.create({
      data: {
        gameId: data.gameId,
        userId: data.userId,
        userGamesStatusId: data.statusIds
      },
      select: {
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        }
      }
    })
  }

  async createUserGameStats(
    userId: string,
    gameId: string,
    completions: number = 1
  ) {
    const userGame = await prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId
        }
      },
      select: {
        id: true
      }
    })

    if (!userGame) return null

    return prisma.userGameStats.upsert({
      where: { userGameId: userGame.id },
      update: { completions },
      create: {
        userGameId: userGame.id,
        completions
      },
      select: {
        completions: true
      }
    })
  }

  async countUserGames(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        _count: {
          select: {
            userGames: true
          }
        }
      }
    })
  }

  async deleteUser(userId: string) {
    return prisma.user.delete({
      where: {
        id: userId
      },
      select: {
        id: true,
        userName: true
      }
    })
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        email: true,
        userBanner: true,
        userName: true,
        profilePicture: true,
        _count: {
          select: {
            userGames: true
          }
        }
      }
    })
  }

  async findManyByIds(statusIds: number) {
    return prisma.userGamesStatus.findMany({
      where: {
        id: statusIds
      }
    })
  }

  async findUserGameStatus(gameId: string, userId: string) {
    return prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      select: {
        UserGamesStatus: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })
  }

  async findUserGame(gameId: string, userId: string) {
    return prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      select: {
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        },
        UserGamesStatus: {
          select: {
            id: true
          }
        }
      }
    })
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

  async findManyGamesOfUser(
    userId: string,
    pageIndex: number = 0,
    itemsPerPage: number = 10,
    sortBy: 'gameName' | 'dateRelease' | 'rating' = 'gameName',
    sortOrder: 'asc' | 'desc' = 'asc',
    query?: string | null,
    filterStatus?: Status | string
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
    const params: any[] = [pageIndex * itemsPerPage, itemsPerPage, userId] // $1, $2, $3

    // vamos calcular índices dos parâmetros dinamicamente para manter a estrutura exatamente igual
    let nextParamIndex = 3
    let statusClause = ''
    if (filterStatus) {
      nextParamIndex++
      statusClause = ` AND ugs."status" = $${nextParamIndex}::"Status"` // Adicione o cast
      params.push(filterStatus)
    }

    if (query) {
      nextParamIndex++
      const nameParamPlaceholder = `$${nextParamIndex}`
      gameIdsQuery = `
    SELECT
      g.id,
      MAX(gl."date_release") as next_release_date,
      COALESCE(AVG(r.value), 0) as avg_rating
    FROM "user_games" ug
    INNER JOIN "games" g ON ug."game_id" = g.id
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    LEFT JOIN "ratings" r ON g.id = r."game_id"
    LEFT JOIN "user_games_status" ugs ON ug.id = ugs."user_game_id"
    WHERE ug."user_id" = $3
    ${statusClause}
    AND g."game_name" ILIKE ${nameParamPlaceholder}
    GROUP BY g.id, g."game_name"
    ORDER BY ${getSortClause(sortBy, sortOrder)}
    OFFSET $1 LIMIT $2
  `
      params.push(`%${query}%`)
    } else {
      gameIdsQuery = `
    SELECT
      g.id,
      MAX(gl."date_release") as next_release_date,
      COALESCE(AVG(r.value), 0) as avg_rating
    FROM "user_games" ug
    INNER JOIN "games" g ON ug."game_id" = g.id
    LEFT JOIN "game_launchers" gl ON g.id = gl."game_id"
    LEFT JOIN "ratings" r ON g.id = r."game_id"
    LEFT JOIN "users_games_status" ugs ON ug."user_games_status_id" = ugs."id"
    WHERE ug."user_id" = $3
    ${statusClause}
    GROUP BY g.id, g."game_name"
    ORDER BY ${getSortClause(sortBy, sortOrder)}
    OFFSET $1 LIMIT $2
  `
    }

    try {
      const gameIds = await prisma.$queryRawUnsafe<
        Array<{
          id: string
          next_release_date: Date | null
          avg_rating: number
        }>
      >(gameIdsQuery, ...params)

      if (gameIds.length === 0) {
        return []
      }

      // busca os userGames correspondentes (mantendo a estrutura de buscar depois dos ids)
      const userGames = await prisma.userGame.findMany({
        where: {
          userId,
          gameId: {
            in: gameIds.map(g => g.id)
          }
        },
        select: {
          id: true,
          gameId: true,
          // mantenha this.getSelectFields() se for seu método; caso contrário adapte o select abaixo
          game: {
            select: this.getSelectFields
              ? this.getSelectFields()
              : {
                  id: true,
                  gameName: true,
                  gameBanner: true,
                  gameLaunchers: {
                    select: {
                      dateRelease: true,
                      platformId: true,
                      platforms: {
                        select: {
                          id: true,
                          platformName: true
                        }
                      }
                    }
                  },
                  isDlc: true
                }
          },
          // ajuste se o status estiver em outra relação
          UserGamesStatus: true,
          updatedAt: true
        }
      })

      // remonta a ordem com base em gameIds (igual ao seu exemplo)
      return gameIds
        .map(({ id }) => {
          return userGames.find(ug => ug.gameId === id)
        })
        .filter(Boolean)
    } catch (error) {
      console.error('Erro na query:', error)
      throw error
    }
  }

  async findGamesCountByStatus(userId: string) {
    const totals = await prisma.userGamesStatus.findMany({
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            userGames: {
              where: { userId }
            }
          }
        }
      }
    })
    return totals
  }

  async findManyUsers({ pageIndex = 0, limit = 18, query = '' } = {}) {
    return prisma.user.findMany({
      where: {
        userName: query
          ? {
              contains: query
            }
          : undefined
      },
      orderBy: [
        {
          userName: 'asc'
        }
      ],
      skip: pageIndex * limit,
      take: limit,
      select: {
        id: true,
        profilePicture: true,
        userBanner: true,
        userName: true,
        _count: {
          select: {
            userGames: true
          }
        }
      }
    })
  }

  async removeGame(gameId: string, userId: string) {
    return prisma.userGame.delete({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      select: {
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        }
      }
    })
  }

  async removeUserGameStats(userId: string, gameId: string) {
    const userGame = await prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId
        }
      },
      select: {
        id: true
      }
    })

    if (!userGame) {
      throw new Error('UserGame not found.')
    }

    return prisma.userGameStats.delete({
      where: {
        userGameId: userGame.id
      },
      select: {
        completions: true
      }
    })
  }

  async updateGameStatus(gameId: string, userId: string, statusId: number) {
    return prisma.userGame.update({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      data: {
        userGamesStatusId: statusId,
        updatedAt: new Date()
      },
      select: {
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true
          }
        },
        UserGamesStatus: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })
  }

  async updateUser(userId: string, data: UpdateUserDTO) {
    let updateData: Partial<UpdateUserDTO> = data

    if (data.profilePicture) {
      updateData.profilePicture = data.profilePicture
    }

    if (data.userBanner) {
      updateData.userBanner = data.userBanner
    }

    if (data.userName) {
      updateData.userName = data.userName
    }

    return prisma.user.update({
      where: {
        id: userId
      },
      data: updateData,
      select: {
        profilePicture: true,
        userBanner: true,
        userName: true
      }
    })
  }

  async findUserGameStats(gameId: string, userId: string) {
    const stats = await prisma.userGameStats.findFirst({
      where: {
        userGame: {
          userId,
          gameId
        }
      },
      select: {
        completions: true
      }
    })
    return { stats }
  }

  async updateUserGamePlayedCount(
    userId: string,
    gameId: string,
    incrementValue: number
  ) {
    const userGame = await prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId
        }
      },
      select: {
        id: true
      }
    })

    if (!userGame) {
      throw new Error('UserGame not found.')
    }

    return prisma.userGameStats.update({
      where: {
        userGameId: userGame.id
      },
      data: {
        completions: {
          increment: incrementValue
        }
      },
      select: {
        completions: true
      }
    })
  }
}
