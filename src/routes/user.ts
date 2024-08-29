import bcrypt from 'bcrypt'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'
import { authMiddleware } from '../middleware/auth.middleware'
import { ClientError } from '../errors/client-error'

export async function createUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/users',
    {
      schema: {
        body: z.object({
          email: z.string().email().min(1, 'Email is a required field.'),
          password: z
            .string()
            .min(6, 'Password required at least 6 characters.')
        }),
        response: {
          200: z.object({
            user: z.object({
              id: z.string().uuid()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body

      if (!email || !password)
        throw new ClientError('Submit all fields for registration')

      const emailAlreadyRegisteredOnDB = await prisma.user.findUnique({
        where: {
          email
        }
      })

      if (emailAlreadyRegisteredOnDB !== null)
        throw new ClientError('This email already used')

      const hash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          password: hash
        },
        select: {
          id: true
        }
      })

      return reply.send({ user })
    }
  )
}

export async function login(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/users/login',
    {
      schema: {
        body: z.object({
          email: z.string().email().min(1, 'Email is a required field.'),
          password: z
            .string()
            .min(6, 'Password required at least 6 characters.')
        }),
        response: {
          200: z.object({
            token: z.string(),
            userId: z.string().uuid()
          })
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body

      if (!email || !password)
        throw new ClientError('Submit all fields for sign up')

      const user = await prisma.user.findUnique({
        where: {
          email
        }
      })

      const isMatch = user && (await bcrypt.compare(password, user.password))
      if (!isMatch) {
        throw new ClientError('Email or password wrong')
      }

      const token = app.jwt.sign({ userId: user.id })
      return reply.send({ token, userId: user.id })
    }
  )
}

export async function getUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/:userId',
      {
        schema: {
          querystring: z.object({
            query: z.string().nullish(),
            pageIndex: z.string().nullish().default('0').transform(Number)
          }),
          params: z.object({
            userId: z.string()
          }),
          response: {
            200: z.object({
              user: z.object({
                id: z.string().uuid(),
                userName: z.string().nullable(),
                profilePicture: z.string().nullable(),
                userBanner: z.string().nullable(),
                userGames: z.array(
                  z.object({
                    game: z.object({
                      id: z.string().uuid(),
                      gameName: z.string(),
                      gameBanner: z.string()
                    }),
                    UserGamesStatus: z.object({
                      id: z.number().int(),
                      status: z.string()
                    })
                  })
                )
              }),

              total: z.number()
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params
        const { pageIndex, query } = request.query
        const count = await prisma.userGame.count({
          where: {
            userId
          }
        })

        const user = await prisma.user.findUnique({
          where: {
            id: userId
          },
          select: {
            id: true,
            userName: true,
            profilePicture: true,
            userBanner: true,
            userGames: {
              take: 20,
              skip: pageIndex * 15,
              orderBy: [
                {
                  game: {
                    gameName: 'asc'
                  }
                }
              ],
              select: {
                game: {
                  select: {
                    id: true,
                    gameName: true,
                    gameBanner: true
                  }
                },
                UserGamesStatus: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              }
            }
          }
        })

        if (user === null) {
          throw new ClientError('User not found.')
        }

        return reply.send({
          user,
          total: count
        })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getAllUsers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users',
      {
        schema: {
          querystring: z.object({
            page: z.coerce.number().optional().default(1)
          }),
          response: {
            200: z.object({
              users: z.array(
                z.object({
                  userName: z.string().nullable(),
                  profilePicture: z.string().nullable()
                })
              ),
              page: z.number(),
              previousPage: z.union([z.number(), z.boolean()]),
              nextPage: z.number(),
              lastPage: z.number(),
              total: z.number().int()
            })
          }
        }
      },
      async (request, reply) => {
        let { page = Number(1) } = request.query
        const limit = 14
        let lastPage = 1
        const count = await prisma.game.count()

        if (count !== 0) {
          lastPage = Math.ceil(count / limit)
        } else {
          throw new ClientError('No game found')
        }

        const [users, usersAmount] = await Promise.all([
          prisma.user.findMany({
            skip: Number(page * limit - limit),
            take: limit,
            orderBy: [
              {
                userName: 'asc'
              }
            ],
            select: {
              userName: true,
              profilePicture: true
            }
          }),
          prisma.user.count({})
        ])

        return reply.send({
          users,
          page,
          previousPage: page - 1 >= 1 ? page - 1 : false,
          nextPage: page + 1 > lastPage ? lastPage : page + 1,
          lastPage,
          total: usersAmount
        })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function addGame(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/users/:userId/userGames/:gameId/:statusId',
      {
        schema: {
          params: z.object({
            gameId: z.string().uuid(),
            userId: z.string().uuid(),
            statusId: z.coerce.number()
          }),
          response: {
            201: z.object({
              gameAdded: z.object({
                game: z.object({
                  id: z.string().uuid(),
                  gameName: z.string()
                })
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId, gameId, statusId } = request.params

        const user = await prisma.user.findUnique({
          where: {
            id: userId
          }
        })

        if (!user) {
          throw new ClientError('User not found.')
        }

        const gameHasBeenAdded = await prisma.userGame.findUnique({
          where: {
            gameId_userId: {
              gameId,
              userId
            }
          },
          include: {
            UserGamesStatus: true
          }
        })

        if (gameHasBeenAdded !== null)
          throw new ClientError(
            'This game has been already added in your library'
          )

        const gameAdded = await prisma.userGame.create({
          data: {
            gameId,
            userId,
            userGamesStatusId: statusId
          },
          select: {
            game: {
              select: {
                id: true,
                gameName: true
              }
            },

            UserGamesStatus: true
          }
        })

        return reply.send({
          gameAdded
        })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function removeGame(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/users/:userId/userGames/:gameId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid(),
            gameId: z.string().uuid()
          }),
          response: {
            200: z.object({
              gameRemoved: z.object({
                game: z.object({
                  id: z.string().uuid(),
                  gameName: z.string()
                })
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId, gameId } = request.params

        const userExists = await prisma.user.findUnique({
          where: {
            id: userId
          }
        })

        if (userExists === null) {
          throw new ClientError('User not found.')
        }

        const gameHasBeenRemoved = await prisma.userGame.findUnique({
          where: {
            gameId_userId: {
              gameId,
              userId
            }
          }
        })

        if (!gameHasBeenRemoved) {
          throw new ClientError(
            'This game has already been removed from your library'
          )
        }

        const gameRemoved = await prisma.userGame.delete({
          where: {
            gameId_userId: {
              gameId,
              userId
            }
          },
          select: {
            game: {
              select: {
                id: true,
                gameName: true
              }
            }
          }
        })

        return reply.send({
          gameRemoved
        })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function updateUserGameStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/userGamesStatus/:userId/:gameId/:statusId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid(),
            gameId: z.string().uuid(),
            statusId: z.coerce.number()
          }),
          response: {
            200: z.object({
              gameStatusUpdated: z.object({
                game: z.object({
                  id: z.string().uuid(),
                  gameName: z.string()
                }),
                UserGamesStatus: z.object({
                  status: z.string()
                })
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId, gameId, statusId } = request.params

        const game = await prisma.userGame.findUnique({
          where: {
            gameId_userId: {
              gameId,
              userId
            }
          },
          include: {
            UserGamesStatus: true
          }
        })

        if (!game) {
          throw new ClientError('This game is not in your library')
        }

        const gameStatusUpdated = await prisma.userGame.update({
          where: {
            gameId_userId: {
              gameId,
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
                gameName: true
              }
            },
            UserGamesStatus: {
              select: {
                status: true
              }
            }
          }
        })

        return reply.send({ gameStatusUpdated })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getGameStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/userGames/:userId/:gameId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid(),
            gameId: z.string().uuid()
          })
        }
      },
      async (request, reply) => {
        const { userId, gameId } = request.params

        const userGameStatus = await prisma.userGame.findUnique({
          where: {
            gameId_userId: {
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

        return reply.send(userGameStatus)
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getAllUserGames(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/:userId/userGames',
      {
        schema: {
          querystring: z.object({
            query: z.string().nullish(),
            pageIndex: z.string().nullish().default('0').transform(Number)
          }),
          params: z.object({
            userId: z.string().uuid()
          })
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        const { pageIndex, query } = request.query
        const count = await prisma.userGame.count({
          where: {
            userId
          }
        })

        const userGames = await prisma.userGame.findMany({
          where: {
            userId: userId,
            game: {
              gameName: query
                ? {
                    contains: query
                  }
                : undefined
            }
          },
          take: 20,
          skip: pageIndex * 15,
          orderBy: [
            { updatedAt: 'desc' },
            {
              createdAt: 'desc'
            }
          ],
          select: {
            game: {
              select: {
                id: true,
                gameName: true,
                gameBanner: true,
                categories: {
                  select: {
                    categoryName: true
                  }
                },
                gameStudio: {
                  select: {
                    studioName: true
                  }
                },
                gameLaunchers: {
                  select: {
                    dateRelease: true,
                    platforms: {
                      select: {
                        platformName: true
                      }
                    }
                  }
                },
                platforms: {
                  select: {
                    platformName: true
                  }
                },
                publisher: {
                  select: {
                    publisherName: true
                  }
                }
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

        return reply.send({ userGames, total: count })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getAllUserFinishedGames(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/:userId/userFinishedGames',
      {
        schema: {
          querystring: z.object({
            query: z.string().nullish(),
            pageIndex: z.string().nullish().default('0').transform(Number)
          }),
          params: z.object({
            userId: z.string().uuid()
          })
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        const { pageIndex, query } = request.query
        const count = await prisma.userGame.count({
          where: {
            userId,
            userGamesStatusId: 1
          }
        })

        const userFinishedGames = await prisma.userGame.findMany({
          where: {
            userId: userId,
            userGamesStatusId: 1,
            game: {
              gameName: query
                ? {
                    contains: query
                  }
                : undefined
            }
          },
          take: 10,
          skip: pageIndex * 10,
          orderBy: [
            { updatedAt: 'desc' },
            {
              createdAt: 'desc'
            }
          ],
          select: {
            game: {
              select: {
                id: true,
                gameName: true,
                gameBanner: true,
                categories: {
                  select: {
                    categoryName: true
                  }
                },
                gameStudio: {
                  select: {
                    studioName: true
                  }
                },
                gameLaunchers: {
                  select: {
                    dateRelease: true,
                    platforms: {
                      select: {
                        platformName: true
                      }
                    }
                  }
                },
                platforms: {
                  select: {
                    platformName: true
                  }
                },
                publisher: {
                  select: {
                    publisherName: true
                  }
                }
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

        return reply.send({ userFinishedGames, total: count })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getAllUserPlayingGames(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/:userId/userPlayingGames',
      {
        schema: {
          querystring: z.object({
            query: z.string().nullish(),
            pageIndex: z.string().nullish().default('0').transform(Number)
          }),
          params: z.object({
            userId: z.string().uuid()
          })
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        const { pageIndex, query } = request.query
        const count = await prisma.userGame.count({
          where: {
            userId,
            userGamesStatusId: 2
          }
        })

        const userPlayingGames = await prisma.userGame.findMany({
          where: {
            userId: userId,
            userGamesStatusId: 2,
            game: {
              gameName: query
                ? {
                    contains: query
                  }
                : undefined
            }
          },
          take: 20,
          skip: pageIndex * 15,
          orderBy: [
            { updatedAt: 'desc' },
            {
              createdAt: 'desc'
            }
          ],
          select: {
            game: {
              select: {
                id: true,
                gameName: true,
                gameBanner: true,
                categories: {
                  select: {
                    categoryName: true
                  }
                },
                gameStudio: {
                  select: {
                    studioName: true
                  }
                },
                gameLaunchers: {
                  select: {
                    dateRelease: true,
                    platforms: {
                      select: {
                        platformName: true
                      }
                    }
                  }
                },
                platforms: {
                  select: {
                    platformName: true
                  }
                },
                publisher: {
                  select: {
                    publisherName: true
                  }
                }
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

        return reply.send({ userPlayingGames, total: count })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function getAllUserPausedGames(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/:userId/userPausedGames',
      {
        schema: {
          querystring: z.object({
            query: z.string().nullish(),
            pageIndex: z.string().nullish().default('0').transform(Number)
          }),
          params: z.object({
            userId: z.string().uuid()
          })
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        const { pageIndex, query } = request.query
        const count = await prisma.userGame.count({
          where: {
            userId,
            userGamesStatusId: 3
          }
        })

        const userPausedGames = await prisma.userGame.findMany({
          where: {
            userId: userId,
            userGamesStatusId: 3,
            game: {
              gameName: query
                ? {
                    contains: query
                  }
                : undefined
            }
          },
          take: 10,
          skip: pageIndex * 10,
          orderBy: [
            { updatedAt: 'desc' },
            {
              createdAt: 'desc'
            }
          ],
          select: {
            game: {
              select: {
                id: true,
                gameName: true,
                gameBanner: true,
                categories: {
                  select: {
                    categoryName: true
                  }
                },
                gameStudio: {
                  select: {
                    studioName: true
                  }
                },
                gameLaunchers: {
                  select: {
                    dateRelease: true,
                    platforms: {
                      select: {
                        platformName: true
                      }
                    }
                  }
                },
                platforms: {
                  select: {
                    platformName: true
                  }
                },
                publisher: {
                  select: {
                    publisherName: true
                  }
                }
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

        return reply.send({ userPausedGames, total: count })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function updateUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .put(
      '/users/:userId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid()
          }),
          body: z
            .object({
              userName: z.string().nullable(),
              profilePicture: z.string().nullable(),
              userBanner: z.string().nullable()
            })
            .partial(),
          response: {
            200: z.object({
              userUpdated: z.object({
                userName: z.string().nullable(),
                profilePicture: z.string().nullable(),
                userBanner: z.string().nullable()
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params
        const { userName, profilePicture, userBanner } = request.body

        const userExists = await prisma.user.findUnique({
          where: {
            id: userId
          }
        })

        if (!userExists) {
          throw new ClientError('This user was not found')
        }

        const userUpdated = await prisma.user.update({
          where: {
            id: userId
          },
          data: {
            userName,
            profilePicture,
            userBanner
          },
          select: {
            userName: true,
            profilePicture: true,
            userBanner: true
          }
        })

        return reply.send({ userUpdated })
      }
    )
    .addHook('preHandler', authMiddleware)
}

export async function deleteUser(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/:userId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid()
          }),
          response: {
            200: z.object({
              userDeleted: z.object({
                id: z.string().uuid(),
                userName: z.string().nullable()
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        const userDeleted = await prisma.user.delete({
          where: {
            id: userId
          },
          select: {
            id: true,
            userName: true
          }
        })

        return reply.send({ userDeleted })
      }
    )
    .addHook('preHandler', authMiddleware)
}
