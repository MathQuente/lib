import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { GameRepository } from '../repositories/games.repository'
import { GameService } from '../services/games.service'
import { GameController } from '../controllers/games.controller'
import * as GameSchema from '../schemas/game.schema'
import { PlatformRepository } from '../repositories/platforms.repository'

const gameRepository = new GameRepository()
const platformRepository = new PlatformRepository()
const gameService = new GameService(gameRepository, platformRepository)
const gameController = new GameController(gameService)

export async function gameRoutes(app: FastifyInstance, opts: any) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        response: {
          200: GameSchema.GetGameResponseSchema
        }
      }
    },
    async (request, reply) => gameController.getGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: GameSchema.GameQueryStringSchema,
        response: {
          // 200: GameSchema.GetGamesResponseSchema
        }
      }
    },
    async (request, reply) => gameController.getAllGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: GameSchema.GameBodySchema,
        response: {
          201: GameSchema.CreateGameResponseSchema
        }
      }
    },
    async (request, reply) => gameController.createGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameId/dateRelease',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        body: GameSchema.CreateGameDateReleaseBodySchema,
        response: {
          201: GameSchema.CreateGameDateReleaseResponseSchema
        }
      }
    },
    async (request, reply) =>
      gameController.createGameDateRelease(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        body: GameSchema.UpdateGameBodySchema,
        response: {
          200: GameSchema.UpdateGameResponseSchema
        }
      }
    },
    async (request, reply) => gameController.updateGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        response: {
          200: GameSchema.DeleteGameResponseSchema
        }
      }
    },
    async (request, reply) => gameController.deleteGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/status',
    {
      schema: {
        response: {
          200: GameSchema.GetGameStatusResponseSchema
        }
      }
    },
    async (request, reply) => gameController.getAllGameStatus(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/similarGames/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        response: {
          200: GameSchema.GetSimilarGamesResponseSchema
        }
      }
    },
    async (request, reply) => gameController.getSimilarGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/test',
    {
      // schema: {
      //   querystring: GameSchema.GameQueryStringSchema,
      //   response: {
      //     200: GameSchema.GetGamesResponseSchema
      //   }
      // }
    },
    async (request, reply) => gameController.test(request, reply)
  )
}
