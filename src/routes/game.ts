import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { string, z } from 'zod'
import { prisma } from '../database/db'

export async function gameRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/games/:gameId',
    {
      schema: {
        params: z.object({
          gameId: z.string().uuid()
        }),
        response: {
          200: z.object({
            game: z.object({
              id: z.string().uuid(),
              gameName: z.string(),
              gameBanner: z.string(),
              gameDateRelease: z.date(),
              categories: z.array(
                z.object({
                  categoryName: z.string()
                })
              ),
              gameStudio: z.object({
                studioName: z.string()
              })
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameId } = request.params

      const game = await prisma.game.findUnique({
        select: {
          id: true,
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
        },
        where: {
          id: gameId
        }
      })

      if (game === null) {
        throw new Error('Game not found.')
      }

      return reply.send({ game })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/games',
    {
      schema: {
        response: {
          200: z.object({
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
        }
      }
    },
    async (request, reply) => {
      const games = await prisma.game.findMany({
        select: {
          id: true,
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
      })

      return reply.send({ games })
    }
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/games/:gameStudioId',
    {
      schema: {
        params: z.object({
          gameStudioId: z.string().uuid()
        }),
        body: z.object({
          gameName: z.string().min(1),
          gameBanner: z.string(),
          gameDateRelease: z.coerce.date(),
          categories: z.array(
            z.object({
              categoryName: z.string()
            })
          )
        }),
        response: {
          201: z.object({
            game: z.object({
              id: string().uuid(),
              gameName: z.string()
            })
          })
        }
      }
    },
    async (request, reply) => {
      const { gameStudioId } = request.params

      const { gameName, gameBanner, categories, gameDateRelease } = request.body

      // Extrair os nomes das categorias do array de objetos
      const categoryNames = categories.map(category => category.categoryName)

      const gameWithSameName = await prisma.game.findUnique({
        where: {
          gameName
        }
      })

      if (gameWithSameName !== null) {
        throw new Error('Game with the same name already exists')
      }

      const game = await prisma.game.create({
        data: {
          gameName,
          gameBanner,
          gameDateRelease,
          gameStudio: {
            connect: {
              id: gameStudioId
            }
          },
          categories: {
            connectOrCreate: categoryNames.map(categoryName => ({
              where: { categoryName }, // Onde buscar a categoria
              create: { categoryName } // Se não encontrar, cria a categoria
            }))
          }
        },
        select: {
          id: true,
          gameName: true
        }
      })

      return reply.send({ game })
    }
  )
}



// TODO: Criar rota para editar um jogo
