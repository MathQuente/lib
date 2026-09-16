import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { FollowService } from '../services/follow.service'
import { FollowController } from '../controllers/follow.controller'
import { FollowRepository } from '../repositories/follow.repository'
import { UserRepository } from '../repositories/users.repository'
import * as FollowSchema from '../schemas/follow.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function followRoutes(app: FastifyInstance) {
  const followRepository = new FollowRepository()
  const userRepository = new UserRepository()
  const followService = new FollowService(followRepository, userRepository)
  const followController = new FollowController(followService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:userId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: FollowSchema.FollowParamsSchema,
        response: {
          204: FollowSchema.FollowActionResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => followController.follow(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:userId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: FollowSchema.FollowParamsSchema,
        response: {
          204: FollowSchema.FollowActionResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => followController.unfollow(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/status/:userId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: FollowSchema.FollowParamsSchema,
        response: {
          200: FollowSchema.IsFollowingResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => followController.getFollowStatus(request, reply)
  )
}
