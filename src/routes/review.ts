import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { ReviewService } from '../services/review.service'
import { ReviewController } from '../controllers/review.controller'
import { ReviewRepository } from '../repositories/review.repository'
import { UserRepository } from '../repositories/users.repository'
import { RatingRepository } from '../repositories/rating.repository'
import * as ReviewSchema from '../schemas/review.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function reviewRoutes(app: FastifyInstance) {
  const reviewRepository = new ReviewRepository()
  const userRepository = new UserRepository()
  const ratingRepository = new RatingRepository()
  const reviewService = new ReviewService(
    reviewRepository,
    userRepository,
    ratingRepository
  )
  const reviewController = new ReviewController(reviewService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: ReviewSchema.ReviewParamsSchema,
        response: {
          200: ReviewSchema.UpsertReviewResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => reviewController.upsertReview(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: ReviewSchema.ReviewParamsSchema,
        response: {
          200: ReviewSchema.GetReviewResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => reviewController.getOwnReview(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: ReviewSchema.ReviewParamsSchema,
        response: {
          204: ReviewSchema.DeleteReviewResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => reviewController.deleteReview(request, reply)
  )
}
