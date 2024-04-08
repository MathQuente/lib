import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'

export async function getGame(app: FastifyInstance) {
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
              gameId: z.string().uuid(),
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

      return reply.send({
        game: {
          gameId,
          gameName: game.gameName,
          gameBanner: game.gameBanner,
          gameDateRelease: game.gameDateRelease,
          categories: game.categories,
          gameStudio: game.gameStudio
        }
      })
    }
  )
}

export async function getAllGames(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/games',
    {
      schema: {
        response: {
          200: z.object({
            games: z.array(
              z.object({
                id: z.string().uuid(),
                gameName: z.string(),
                gameBanner: z.string().nullable(),
                gameDateRelease: z.date(),
                categories: z.array(z.string()),
                gameStudio: z.string()
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

      if (games.length === 0) {
        throw new Error('No games found.')
      }

      const formattedGames = games.map(game => ({
        id: game.id,
        gameName: game.gameName,
        gameBanner: game.gameBanner,
        gameDateRelease: game.gameDateRelease,
        categories: game.categories.map(category => category.categoryName),
        gameStudio: game.gameStudio.studioName
      }))

      return reply.send({ games: formattedGames })
    }
  )
}

export async function createGame(app: FastifyInstance) {
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
            gameId: z.string().uuid()
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
        }
      })

      return reply.send({ gameId: game.id })
    }
  )
}
