import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'
import { FastifyInstance } from 'fastify'

export async function createGameStudio(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/gameStudios',
    {
      schema: {
        body: z.object({
          studioName: z.string().min(1)
        }),
        response: {
          201: z.object({
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

      return reply.status(201).send({ studioId: studio.id })
    }
  )
}

export async function getGameStudio(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/gameStudios/:gameStudioId',
    {
      schema: {
        params: z.object({
          gameStudioId: z.string().uuid()
        }),
        response: {
          200: z.object({
            gameStudio: z.object({
              id: z.string().uuid(),
              gamesAmount: z.number().int().nullable(),
              games: z.array(
                z.object({
                  gameName: z.string(),
                  gameBanner: z.string(),
                  gameDateRelease: z.date(),
                  categories: z.array(
                    z.object({
                      categoryName: z.string()
                    })
                  )
                })
              )
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameStudioId } = request.params

      const gameStudio = await prisma.gameStudio.findUnique({
        where: {
          id: gameStudioId
        },
        select: {
          studioName: true,
          _count: {
            select: {
              game: true
            }
          },
          game: {
            select: {
              gameName: true,
              gameBanner: true,
              gameDateRelease: true,
              categories: {
                select: {
                  categoryName: true
                }
              }
            }
          }
        }
      })

      if (gameStudio === null) {
        throw new Error('Game Studio not found.')
      }

      return reply.send({
        gameStudio: {
          id: gameStudioId,
          gamesAmount: gameStudio._count.game,
          games: gameStudio.game
        }
      })
    }
  )
}


