import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { RatingService } from '../services/rating.service'
import { RatingController } from '../controllers/rating.controller'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameRepository } from '../repositories/games.repository'
import * as RatingSchema from '../schemas/rating.schema'
import { authMiddleware } from '../middleware/auth.middleware'

export async function ratingRoutes(app: FastifyInstance) {
  const ratingRepository = new RatingRepository()
  const userRepository = new UserRepository()
  const gameRepository = new GameRepository()
  const ratingService = new RatingService(
    ratingRepository,
    userRepository,
    gameRepository
  )
  const ratingController = new RatingController(ratingService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          201: RatingSchema.RatingResponseSchema
        }
      }
    },
    async (request, reply) =>
      ratingController.createRatingToGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.RatingResponseSchema
        }
      }
    },
    async (request, reply) => ratingController.getUserGameRating(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId/ratings/average',
    {
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          // 200: RatingSchema.RatingResponseSchema
        }
      }
    },
    async (request, reply) =>
      ratingController.getAverageRatingOfGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          // 200: RatingSchema.RatingResponseSchema
        }
      }
    },
    async (request, reply) => ratingController.deleteRating(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: {
          200: RatingSchema.GetRatingsResponseSchema
        }
      }
    },
    async (request, reply) => ratingController.getAllRatings(request, reply)
  )
}
