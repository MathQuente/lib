import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { string, z } from 'zod'
import { prisma } from '../database/db'

export async function gameRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId',
    {
      schema: {
        params: z.object({
          gameId: z.string().uuid()
        }),
        response: {
          200: z.object({
            gameFound: z.object({
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
        }
      }
    },
    async (request, reply) => {
      const { gameId } = request.params

      const gameFound = await prisma.game.findUnique({
        where: {
          id: gameId
        },
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
            orderBy: {
              dateRelease: 'asc'
            },
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
      })

      if (gameFound === null) {
        throw new Error('Game not found.')
      }

      return reply.send({ gameFound })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: z.object({
          query: z.string().nullish(),
          pageIndex: z.string().nullish().default('0').transform(Number)
        }),
        response: {
          200: z.object({
            games: z.array(
              z.object({
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
            ),
            total: z.number()
          })
        }
      }
    },
    async (request, reply) => {
      const { pageIndex, query } = request.query
      const count = await prisma.game.count()

      const games = await prisma.game.findMany({
        where: {
          gameName: query
            ? {
                contains: query
              }
            : undefined
        },
        take: 15,
        skip: pageIndex * 15,
        orderBy: [
          {
            gameName: 'asc'
          }
        ],
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
            orderBy: {
              dateRelease: 'asc'
            },
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
      })

      return reply.send({
        games,
        total: count
      })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameStudioId',
    {
      schema: {
        params: z.object({
          gameStudioId: z.string().uuid()
        }),
        body: z.object({
          gameName: z.string().min(1),
          gameBanner: z.string(),
          categories: z.array(
            z.object({
              categoryName: z.string()
            })
          ),
          platforms: z.array(
            z.object({
              platformName: z.string()
            })
          )
        }),
        response: {
          200: z.object({
            gameCreated: z.object({
              id: string().uuid(),
              gameName: z.string()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameStudioId } = request.params
      const { gameName, gameBanner, categories, platforms } = request.body

      const categoryNames = categories.map(category => category.categoryName)
      const platformNames = platforms.map(platform => platform.platformName)

      const gameWithSameName = await prisma.game.findUnique({
        where: {
          gameName
        }
      })

      if (gameWithSameName !== null) {
        throw new Error('Game with the same name already exists')
      }

      const gameCreated = await prisma.game.create({
        data: {
          gameName,
          gameBanner,
          gameStudio: {
            connect: {
              id: gameStudioId
            }
          },
          categories: {
            connectOrCreate: categoryNames.map(categoryName => ({
              where: { categoryName },
              create: { categoryName }
            }))
          },
          platforms: {
            connectOrCreate: platformNames.map(platformName => ({
              where: {
                platformName
              },
              create: {
                platformName
              }
            }))
          },
          publisher: {
            connect: {
              id: '2343243'
            }
          }
        },
        select: {
          id: true,
          gameName: true
        }
      })

      return reply.send({ gameCreated })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameId/dateRelease',
    {
      schema: {
        params: z.object({
          gameId: z.string().uuid()
        }),
        body: z.object({
          dateRelease: z.coerce.date(),
          platformId: z.string().uuid()
        }),
        response: {
          200: z.object({
            gameDateReleaseOnPlataform: z.object({
              platforms: z.object({
                platformName: z.string()
              }),
              dateRelease: z.date()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameId } = request.params

      const { platformId, dateRelease } = request.body

      const gameAlreadyExist = await prisma.game.findUnique({
        where: {
          id: gameId
        }
      })

      if (gameAlreadyExist == null) {
        throw new Error('This game does not exist')
      }

      const gameDateReleaseAlreadyExistOnPlataform =
        await prisma.gameLauncher.findUnique({
          where: {
            platformId_gameId: {
              platformId,
              gameId
            }
          }
        })

      if (gameDateReleaseAlreadyExistOnPlataform) {
        throw new Error('This game has already been release on this date')
      }

      const gameDateReleaseOnPlataform = await prisma.gameLauncher.create({
        data: {
          dateRelease,
          gameId,
          platformId
        },
        select: {
          platforms: {
            select: {
              platformName: true
            }
          },
          dateRelease: true
        }
      })

      return reply.status(200).send({ gameDateReleaseOnPlataform })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:gameId',
    {
      schema: {
        params: z.object({
          gameId: z.string().uuid()
        }),
        body: z.object({
          gameBanner: z.string(),
          categories: z.array(
            z.object({
              categoryName: z.string()
            })
          )
        }),
        response: {
          200: z.object({
            gameUpdated: z.object({
              id: string().uuid(),
              gameName: z.string()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameId } = request.params

      const { gameBanner, categories } = request.body
      const categoryNames = categories.map(category => category.categoryName)

      const gameAlreadyExist = await prisma.game.findUnique({
        where: {
          id: gameId
        }
      })

      if (!gameAlreadyExist) {
        throw new Error('This game does not exist')
      }

      const gameUpdated = await prisma.game.update({
        where: {
          id: gameId
        },
        data: {
          gameBanner,
          categories: {
            connectOrCreate: categoryNames.map(categoryName => ({
              where: { categoryName },
              create: { categoryName }
            }))
          }
        },
        select: {
          id: true,
          gameName: true
        }
      })

      return reply.status(200).send({ gameUpdated })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:gameId',
    {
      schema: {
        params: z.object({
          gameId: z.string().uuid()
        }),
        response: {
          200: z.object({
            gameDeleted: z.object({
              id: z.string().uuid(),
              gameName: z.string()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameId } = request.params

      const gameHasBeenRemoved = await prisma.game.findUnique({
        where: {
          id: gameId
        }
      })

      if (!gameHasBeenRemoved) {
        throw new Error('This game has already been removed from your library')
      }

      const gameDeleted = await prisma.game.delete({
        where: {
          id: gameId
        },
        select: {
          id: true,
          gameName: true
        }
      })

      return reply.send({
        gameDeleted
      })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/gameStatus',
    {
      schema: {
        querystring: z.object({
          pageIndex: z.string().nullish().default('0').transform(Number)
        })
      }
    },
    async (request, reply) => {
      const { pageIndex } = request.query

      const gameStatus = await prisma.userGamesStatus.findMany({
        take: 3,
        skip: pageIndex * 3,
        orderBy: [
          {
            status: 'asc'
          }
        ],
        select: {
          id: true,
          status: true
        }
      })

      return reply.send(gameStatus)
    }
  )
}
