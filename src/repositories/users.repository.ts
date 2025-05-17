import { prisma } from '../database/db'
import { AddGameDTO, UpdateUserDTO } from '../dtos/users.dto'

export class UserRepository {
  async addGameToUserLibrary(data: AddGameDTO) {
    const connectStatuses = data.statusIds.map(id => ({ id }))

    return prisma.userGame.create({
      data: {
        gameId: data.gameId,
        userId: data.userId,
        statuses: { connect: connectStatuses }
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
    completions: number = 0
  ) {
    const userGame = await prisma.userGame.upsert({
      where: {
        userId_gameId: {
          userId,
          gameId
        }
      },
      update: {},
      create: {
        userId,
        gameId
      }
    })

    return prisma.userGameStats.create({
      data: {
        userGameId: userGame.id,
        completions: completions
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

  async findManyByIds(statusIds: number[]) {
    return prisma.userGamesStatus.findMany({
      where: {
        id: {
          in: statusIds
        }
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
        statuses: {
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
        }
      }
    })
  }

  async findManyGamesOfUser(
    userId: string,
    filter: number | undefined,
    { pageIndex = 0, limit = 18, query = '' } = {}
  ) {
    return prisma.userGame.findMany({
      where: {
        userId,
        OR: query
          ? [
              {
                game: {
                  gameName: { contains: query }
                }
              }
            ]
          : undefined,
        statuses: {
          some: {
            id: filter
          }
        }
      },
      skip: pageIndex * limit,
      take: limit,
      orderBy: [
        {
          updatedAt: 'desc'
        }
      ],
      select: {
        game: {
          select: {
            id: true,
            gameBanner: true,
            gameName: true,
            isDlc: true
          }
        },
        statuses: {
          select: {
            status: true
          }
        }
      }
    })
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

  async updateGameStatus(gameId: string, userId: string, statusIds: number[]) {
    const connectStatuses = statusIds.map(id => ({ id }))

    return prisma.userGame.update({
      where: {
        userId_gameId: {
          gameId,
          userId
        }
      },
      data: {
        statuses: {
          set: [], // Primeiro desconecta todos
          connect: connectStatuses // Depois conecta os novos
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
        statuses: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })
  }

  async updateUser(userId: string, data: UpdateUserDTO) {
    let updateData: Partial<UpdateUserDTO> = {}

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
      data,
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
    return stats
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
