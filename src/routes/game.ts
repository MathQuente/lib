import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { GameService } from '../services/games.service'
import { GameController } from '../controllers/games.controller'
import { RatingRepository } from '../repositories/rating.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { UserRepository } from '../repositories/users.repository'
import * as GameSchema from '../schemas/game.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function gameRoutes(app: FastifyInstance) {
  const ratingRepository = new RatingRepository()
  const gameCacheRepository = new GameCacheRepository()
  const userRepository = new UserRepository()
  const gameService = new GameService(ratingRepository, gameCacheRepository, userRepository)
  const gameController = new GameController(gameService)
  app.withTypeProvider<ZodTypeProvider>().get(
    '/featured',
    {
      schema: {
        response: {
          200: GameSchema.GetFeaturedGamesResponseSchema,
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
        querystring: GameSchema.ComingSoonQueryStringSchema,
        response: {
          200: GameSchema.GetGamesResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => gameController.getComingSoonGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/similarGames/:igdbId',
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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:igdbId',
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
}
