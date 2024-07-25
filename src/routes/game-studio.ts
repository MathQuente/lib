import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'

export async function gameStudioRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: z.object({
          studioName: z.string().min(1)
        }),
        response: {
          200: z.object({
            studioId: z.string().uuid()
          })
        }
      }
    },
    async (request, reply) => {
      const { studioName } = request.body

      const studioWithSameName = await prisma.gameStudio.findUnique({
        where: {
          studioName
        }
      })

      if (studioWithSameName !== null) {
        throw new Error('Another studio with same name already exists')
      }

      const studio = await prisma.gameStudio.create({
        data: {
          studioName
        }
      })

      return reply.send({ studioId: studio.id })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameStudioId',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().optional().default(1)
        }),
        params: z.object({
          gameStudioId: z.string().uuid()
        }),
        response: {
          200: z.object({
            gameStudio: z.object({
              id: z.string().uuid(),
              studioName: z.string(),
              gamesAmount: z.number(),
              games: z.array(
                z.object({
                  id: z.string().uuid(),
                  gameName: z.string(),
                  gameBanner: z.string()
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
      const { gameStudioId } = request.params

      let { page = Number(1) } = request.query
      const limit = 14
      let lastPage = 1

      const count = await prisma.gameStudio.findMany({
        include: {
          _count: {
            select: {
              games: true
            }
          }
        }
      })

      if (count.length !== 0) {
        lastPage = Math.ceil(count.length / limit)
      } else {
        throw new Error('No game found')
      }

      const gameStudio = await prisma.gameStudio.findUnique({
        where: {
          id: gameStudioId
        },
        select: {
          id: true,
          studioName: true,
          _count: {
            select: {
              games: true
            }
          },
          games: {
            skip: Number(page * limit - limit),
            take: limit,
            orderBy: [
              {
                gameName: 'asc'
              }
            ],
            select: {
              id: true,
              gameName: true,
              gameBanner: true
            }
          }
        }
      })

      if (gameStudio === null) {
        throw new Error('Game Studio not found.')
      }

      return reply.send({
        gameStudio: {
          id: gameStudio.id,
          studioName: gameStudio.studioName,
          gamesAmount: gameStudio._count.games,
          games: gameStudio.games
        },
        page,
        previousPage: page - 1 >= 1 ? page - 1 : false,
        nextPage: page + 1 > lastPage ? lastPage : page + 1,
        lastPage,
        total: count.length
      })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:studioId',
    {
      schema: {
        params: z.object({
          studioId: z.string().uuid()
        }),
        response: {
          200: z.object({
            studioDeleted: z.object({
              id: z.string().uuid(),
              studioName: z.string()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { studioId } = request.params

      const gameStudioAlreadyExist = await prisma.gameStudio.findUnique({
        where: {
          id: studioId
        }
      })

      if (gameStudioAlreadyExist === null) {
        throw new Error(
          'This game studio does not exist. You cannnot delete this studio'
        )
      }

      const studioDeleted = await prisma.gameStudio.delete({
        where: {
          id: studioId
        },
        select: {
          id: true,
          studioName: true
        }
      })
      return reply.send({ studioDeleted })
    }
  )
}
