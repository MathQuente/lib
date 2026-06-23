import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { RatingService } from '../services/rating.service'
import { RatingController } from '../controllers/rating.controller'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import * as RatingSchema from '../schemas/rating.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function ratingRoutes(app: FastifyInstance) {
  const ratingRepository = new RatingRepository()
  const userRepository = new UserRepository()
  const ratingService = new RatingService(ratingRepository, userRepository)
  const ratingController = new RatingController(ratingService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          201: RatingSchema.CreateRatingResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.createRatingToGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getUserGameRating(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:igdbId/average',
    {
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingAverageResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.getAverageRatingOfGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          204: RatingSchema.DeleteRatingResponseSchema,
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
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getAllRatings(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/game/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetManyRatingsByGameResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => ratingController.getCountByGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/ratingDistribution/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: RatingSchema.RatingParamsSchema,
        response: {
          200: RatingSchema.GetRatingDistributionResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      ratingController.getRatingDistribution(request, reply)
  )
}
