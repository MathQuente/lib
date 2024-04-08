import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'
import bcrypt from 'bcrypt'

export async function userRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/users',
    {
      schema: {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(6)
        }),
        response: {
          201: z.object({
            user: z.object({
              id: z.string().uuid()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body

      const emailAlreadyRegisterOnDB = await prisma.user.findUnique({
        where: {
          email
        }
      })

      if (emailAlreadyRegisterOnDB !== null) {
        throw new Error('This email already used')
      }

      const newPassword = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: {
          email,
          password: newPassword
        },
        select: {
          id: true
        }
      })

      return reply.status(201).send({ user })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/users/:userId',
    {
      schema: {
        params: z.object({
          userId: z.string().uuid()
        }),
        response: {
          200: z.object({
            user: z.object({
              id: z.string().uuid(),
              userName: z.string().nullable(),
              profilePicture: z.string().nullable()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { userId } = request.params

      const user = await prisma.user.findUnique({
        select: {
          id: true,
          userName: true,
          profilePicture: true
        },
        where: {
          id: userId
        }
      })

      if (user === null) {
        throw new Error('User not found.')
      }

      return reply.send({ user })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/users',
    {
      schema: {
        response: {
          200: z.object({
            users: z.array(
              z.object({
                userName: z.string().nullable(),
                profilePicture: z.string().nullable()
              })
            ),
            usersAmount: z.number().int()
          })
        }
      }
    },
    async (request, reply) => {
      const [users, usersAmount] = await Promise.all([
        prisma.user.findMany({
          select: {
            userName: true,
            profilePicture: true
          }
        }),
        prisma.user.count({})
      ])

      return reply.send({ users, usersAmount })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/users/:userId/userGames/:gameId',
    {
      schema: {
        body: z.object({
          status: z.number().int()
        }),
        params: z.object({
          gameId: z.string().uuid(),
          userId: z.string().uuid()
        }),
        response: {
          201: z.object({
            gameAdded: z.object({
              game: z.object({
                id: z.string().uuid(),
                gameName: z.string()
              }),
              user: z.object({
                id: z.string().uuid(),
                userName: z.string().nullable()
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

      const { status } = request.body

      const gameHasBeenAdded = await prisma.userGames.findFirst({
        where: {
          userId,
          gameId
        }
      })

      if (gameHasBeenAdded) {
        throw new Error('This game has already been added to your library.')
      }

      const gameAdded = await prisma.userGames.create({
        data: {
          gameId,
          userId,
          userGamesStatusId: status
        },
        select: {
          game: {
            select: {
              id: true,
              gameName: true
            }
          },
          user: {
            select: {
              id: true,
              userName: true
            }
          }
        }
      })

      return reply.send({
        gameAdded
      })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
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
              }),
              user: z.object({
                id: z.string().uuid(),
                userName: z.string().nullable()
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

      const gameHasBeenRemoved = await prisma.userGames.findUnique({
        where: {
          gameId_userId: {
            gameId,
            userId
          }
        }
      })

      if (!gameHasBeenRemoved) {
        throw new Error('This game has already been removed from your library')
      }

      const gameRemoved = await prisma.userGames.delete({
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
          },
          user: {
            select: {
              id: true,
              userName: true
            }
          }
        }
      })

      return reply.send({
        gameRemoved
      })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/users/:userId/userGames/:gameId',
    {
      schema: {
        params: z.object({
          userId: z.string().uuid(),
          gameId: z.string().uuid()
        }),
        body: z.object({
          status: z.number().int()
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
      const { userId, gameId } = request.params
      const { status } = request.body

      const game = await prisma.userGames.findUnique({
        where: {
          gameId_userId: {
            gameId,
            userId
          }
        }
      })

      if (!game) {
        throw new Error('This game is not in your library')
      }

      const gameStatusUpdated = await prisma.userGames.update({
        where: {
          gameId_userId: {
            gameId,
            userId
          }
        },
        data: {
          userGamesStatusId: status
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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/users/:userId/userGames',
    {
      schema: {
        params: z.object({
          userId: z.string().uuid()
        }),
        response: {
          200: z.object({
            userGames: z.array(
              z.object({
                game: z.object({
                  gameName: z.string(),
                  gameBanner: z.string(),
                  gameDateRelease: z.date(),
                  categories: z.array(
                    z.object({
                      categoryName: z.string()
                    })
                  )
                })
              })
            ),
            userGamesAmount: z.number().int()
          })
        }
      }
    },
    async (request, reply) => {
      const { userId } = request.params

      const [userGames, userGamesAmount] = await Promise.all([
        prisma.userGames.findMany({
          where: {
            userId: userId
          },
          select: {
            game: {
              select: {
                gameName: true,
                gameBanner: true,
                gameDateRelease: true,
                categories: {
                  select: {
                    categoryName: true
                  }
                },
                gameStudio: {
                  select: {
                    studioName: true
                  }
                }
              }
            }
          }
        }),
        prisma.userGames.count({
          where: {
            userId: userId
          }
        })
      ])

      return reply.send({ userGames, userGamesAmount })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
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

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/users/:userId',
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
}
