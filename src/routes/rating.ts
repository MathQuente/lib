import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { RatingService } from '../services/rating.service'
import { RatingController } from '../controllers/rating.controller'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameRepository } from '../repositories/games.repository'
import * as RatingSchema from '../schemas/rating.schema'
import { ErrorSchemas } from '../schemas/error.schema'

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
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          201: RatingSchema.CreateRatingResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.createRatingToGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getUserGameRating(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameId/average',
    {
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingAverageResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.getAverageRatingOfGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          204: RatingSchema.DeleteRatingResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
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
          200: RatingSchema.GetRatingsResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getAllRatings(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/game/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetManyRatingsByGameResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getCountByGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/ratingDistribution/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingDistributionResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.getRatingDistribution(request, reply)
  )
}
