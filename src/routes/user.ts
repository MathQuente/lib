import bcrypt from 'bcrypt'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'
import { authMiddleware } from '../middleware/auth.middleware'

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
        throw new Error('Submit all fields for registration')

      const emailAlreadyRegisteredOnDB = await prisma.user.findUnique({
        where: {
          email
        }
      })

      if (emailAlreadyRegisteredOnDB !== null)
        throw new Error('This email already used')

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

      if (!email || !password) throw new Error('Submit all fields for sign up')

      const user = await prisma.user.findUnique({
        where: {
          email
        }
      })

      const isMatch = user && (await bcrypt.compare(password, user.password))
      if (!isMatch) {
        throw new Error('Email or password wrong')
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
            page: z.coerce.number().optional().default(1)
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
              page: z.number(),
              previousPage: z.union([z.number(), z.boolean()]),
              nextPage: z.number(),
              lastPage: z.number(),
              total: z.number()
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params
        const limit = 14
        let { page } = request.query
        let lastPage

        const count = await prisma.userGame.count({
          where: {
            userId
          }
        })

        if (count !== 0) {
          lastPage = Math.ceil(count / limit)
        } else {
          throw new Error('No game found')
        }

        const user = await prisma.user.findUnique({
          where: {
            id: userId
          },
          select: {
            id: true,
            userName: true,
            profilePicture: true,
            userGames: {
              skip: Number(page * limit - limit),
              take: limit,
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
          throw new Error('User not found.')
        }

        return reply.send({
          user,
          page,
          previousPage: page - 1 >= 1 ? page - 1 : false,
          nextPage: page + 1 > lastPage ? lastPage : page + 1,
          lastPage,
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
          throw new Error('No game found')
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
    .get(
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
          throw new Error('User not found.')
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

        if (gameHasBeenAdded !== null) {
          throw new Error('This game has been already added in your library')
        }

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
          throw new Error('User not found.')
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
          throw new Error(
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
    .get(
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
        console.log('oi')

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
          throw new Error('This game is not in your library')
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
      '/userGames/:userId/:gameId/:statusId',
      {
        schema: {
          params: z.object({
            userId: z.string().uuid(),
            gameId: z.string().uuid(),
            statusId: z.coerce.number()
          }),
          response: {
            200: z.object({
              gameStatus: z
                .object({
                  UserGamesStatus: z.object({
                    status: z.string()
                  })
                })
                .nullable()
            })
          }
        }
      },
      async (request, reply) => {
        const { userId, gameId, statusId } = request.params

        const gameStatus = await prisma.userGame.findUnique({
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

        reply.send({ gameStatus })

        if (!gameStatus) {
          return reply.redirect(
            `http://localhost:3333/users/${userId}/userGames/${gameId}/${statusId}`
          )
        }

        return reply.redirect(
          `http://localhost:3333/userGamesStatus/${userId}/${gameId}/${statusId}`
        )
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
            page: z.coerce.number().optional().default(1)
          }),
          params: z.object({
            userId: z.string().uuid()
          }),
          response: {
            200: z.object({
              userGames: z.array(
                z.object({
                  game: z.object({
                    id: z.string().uuid(),
                    gameName: z.string(),
                    gameBanner: z.string(),
                    categories: z.array(
                      z.object({
                        categoryName: z.string()
                      })
                    ),
                    gameStudio: z.object({
                      studioName: z.string()
                    }),
                    gameLaunchers: z.array(
                      z.object({
                        dateRelease: z.date(),
                        platforms: z.object({
                          platformName: z.string()
                        })
                      })
                    ),
                    platforms: z.array(
                      z.object({
                        platformName: z.string()
                      })
                    )
                  })
                })
              ),
              page: z.number(),
              previousPage: z.union([z.number(), z.boolean()]),
              nextPage: z.number(),
              lastPage: z.number(),
              total: z.number()
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params

        let { page } = request.query
        const limit = 14
        let lastPage
        const count = await prisma.userGame.count({
          where: {
            userId
          }
        })

        if (count !== 0) {
          lastPage = Math.ceil(count / limit)
        } else {
          throw new Error('No game found')
        }

        const userGames = await prisma.userGame.findMany({
          where: {
            userId: userId
          },
          skip: Number(page * limit - limit),
          take: limit,
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
                }
              }
            }
          }
        })

        return reply.send({
          userGames,
          page,
          previousPage: page - 1 >= 1 ? page - 1 : false,
          nextPage: page + 1 > lastPage ? lastPage : page + 1,
          lastPage,
          total: count
        })
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
              profilePicture: z.string().nullable()
            })
            .partial(),
          response: {
            200: z.object({
              userUpdated: z.object({
                userName: z.string().nullable(),
                profilePicture: z.string().nullable()
              })
            })
          }
        }
      },
      async (request, reply) => {
        const { userId } = request.params
        const { userName, profilePicture } = request.body

        const userExists = await prisma.user.findUnique({
          where: {
            id: userId
          }
        })

        if (!userExists) {
          throw new Error('This user was not found')
        }

        const userUpdated = await prisma.user.update({
          where: {
            id: userId
          },
          data: {
            userName,
            profilePicture
          },
          select: {
            userName: true,
            profilePicture: true
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
