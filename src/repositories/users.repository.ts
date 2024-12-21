import { prisma } from '../database/db'
import { AddGameDTO, UpdateUserDTO } from '../dtos/users.dto'

export class UserRepository {
  async addItem(data: AddGameDTO) {
    if (data.type === 'game') {
      return prisma.userGame.create({
        data: {
          gameId: data.itemId,
          userId: data.userId,
          userGamesStatusId: data.statusId
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
    return prisma.userGame.create({
      data: {
        dlcId: data.itemId,
        userId: data.userId,
        userGamesStatusId: data.statusId
      },
      select: {
        dlc: {
          select: {
            id: true,
            dlcBanner: true,
            dlcName: true
          }
        }
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

  async findUserItemStatus(
    itemId: string,
    userId: string,
    type: 'game' | 'dlc'
  ) {
    if (type === 'game') {
      return prisma.userGame.findUnique({
        where: {
          userId_gameId: {
            gameId: itemId,
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

    return prisma.userGame.findUnique({
      where: {
        userId_dlcId: {
          dlcId: itemId,
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

  async findUserItem(itemId: string, userId: string, type: 'game' | 'dlc') {
    if (type === 'game') {
      return prisma.userGame.findUnique({
        where: {
          userId_gameId: {
            gameId: itemId,
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

    return prisma.userGame.findUnique({
      where: {
        userId_dlcId: {
          dlcId: itemId,
          userId
        }
      },
      select: {
        dlc: {
          select: {
            id: true,
            dlcBanner: true,
            dlcName: true
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
              },
              {
                dlc: {
                  dlcName: { contains: query }
                }
              }
            ]
          : undefined,
        UserGamesStatus: {
          id: filter
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
            dlcs: {
              orderBy: [
                {
                  dlcName: 'asc'
                }
              ],
              select: {
                id: true,
                dlcBanner: true,
                dlcName: true
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
            summary: true
          }
        },
        dlc: {
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
            game: {
              select: {
                id: true,
                gameBanner: true,
                gameName: true
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

  async findGamesCountByStatus(userId: string) {
    const totalGamesByStatus = await prisma.userGame.groupBy({
      by: ['userGamesStatusId'],
      where: {
        userId // Filtrar pelo usuário
      },
      _count: {
        userGamesStatusId: true // Contar a quantidade de registros para cada status
      }
    })

    return totalGamesByStatus
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

  async removeItem(itemId: string, userId: string, type: 'game' | 'dlc') {
    if (type === 'game') {
      return prisma.userGame.delete({
        where: {
          userId_gameId: {
            gameId: itemId,
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

    return prisma.userGame.delete({
      where: {
        userId_dlcId: {
          dlcId: itemId,
          userId
        }
      },
      select: {
        dlc: {
          select: {
            id: true,
            dlcBanner: true,
            dlcName: true
          }
        }
      }
    })
  }

  async updateItemStatus(
    itemId: string,
    userId: string,
    statusId: number,
    type: 'game' | 'dlc'
  ) {
    if (type === 'game') {
      return prisma.userGame.update({
        where: {
          userId_gameId: {
            gameId: itemId,
            userId
          }
        },
        data: {
          userGamesStatusId: statusId
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

    return prisma.userGame.update({
      where: {
        userId_dlcId: {
          dlcId: itemId,
          userId
        }
      },
      data: {
        userGamesStatusId: statusId
      },
      select: {
        dlc: {
          select: {
            id: true,
            dlcBanner: true,
            dlcName: true
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
}
