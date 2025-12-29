import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { GameRepository } from '../repositories/games.repository'
import { GameService } from '../services/games.service'
import { GameController } from '../controllers/games.controller'
import * as GameSchema from '../schemas/game.schema'
import { RatingRepository } from '../repositories/rating.repository'
import { ErrorSchemas } from '../schemas/error.schema'

const gameRepository = new GameRepository()
const ratingRepository = new RatingRepository()

const gameService = new GameService(gameRepository, ratingRepository)
const gameController = new GameController(gameService)

export async function gameRoutes(app: FastifyInstance, opts: any) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        response: {
          200: GameSchema.GetGameResponseSchema,
          404: ErrorSchemas.NotFound
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
          200: GameSchema.GetGamesResponseSchema,
          500: ErrorSchemas.InternalServerError
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
          201: GameSchema.CreateGameResponseSchema,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => gameController.createGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        body: GameSchema.UpdateGameBodySchema,
        response: {
          200: GameSchema.UpdateGameResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
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
          200: GameSchema.DeleteGameResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => gameController.deleteGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/similarGames/:gameId',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        response: {
          200: GameSchema.GetSimilarGamesResponseSchema,
          404: ErrorSchemas.NotFound
        }
      }
    },
    async (request, reply) => gameController.getSimilarGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/featured',
    {
      schema: {
        response: {
          // 200: GameSchema.GetFeaturedGamesResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => gameController.getFeaturedGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/comingSoon',
    {
      schema: {
        // response: {
        //   200: GameSchema.GetGamesResponseSchema,
        //   500: ErrorSchemas.InternalServerError
        // }
      }
    },
    async (request, reply) => gameController.getComingSoonGames(request, reply)
  )
}
