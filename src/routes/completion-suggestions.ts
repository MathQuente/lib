import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { CompletionSuggestionController } from '../controllers/completion-suggestion.controller'
import { CompletionSuggestionRepository } from '../repositories/completion-suggestion.repository'
import { FollowRepository } from '../repositories/follow.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserRepository } from '../repositories/users.repository'
import { ErrorSchemas } from '../schemas/error.schema'
import * as SuggestionSchema from '../schemas/completion-suggestion.schema'
import { CompletionSuggestionService } from '../services/completion-suggestion.service'
import { GameCacheService } from '../services/game-cache.service'
import { UserService } from '../services/users.service'

export async function completionSuggestionRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const userService = new UserService(
    userRepository,
    new RatingRepository(),
    new GameCacheService(new GameCacheRepository()),
    new FollowRepository()
  )
  const suggestionService = new CompletionSuggestionService(
    new CompletionSuggestionRepository(),
    userService,
    new UserGamePlatformRepository()
  )
  const controller = new CompletionSuggestionController(suggestionService)

  const errors = {
    400: ErrorSchemas.BadRequest,
    404: ErrorSchemas.NotFound,
    409: ErrorSchemas.BadRequest,
    500: ErrorSchemas.InternalServerError
  }

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: SuggestionSchema.SuggestionListQuerySchema,
        response: {
          200: SuggestionSchema.SuggestionListResponseSchema,
          ...errors
        }
      }
    },
    async (request, reply) => controller.list(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:igdbId/accept',
    {
      preHandler: [app.authenticate],
      schema: {
        params: SuggestionSchema.SuggestionParamsSchema,
        response: {
          200: SuggestionSchema.SuggestionAcceptResponseSchema,
          ...errors
        }
      }
    },
    async (request, reply) => controller.accept(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:igdbId/dismiss',
    {
      preHandler: [app.authenticate],
      schema: {
        params: SuggestionSchema.SuggestionParamsSchema,
        response: {
          204: SuggestionSchema.SuggestionDismissResponseSchema,
          ...errors
        }
      }
    },
    async (request, reply) => controller.dismiss(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:igdbId/undo',
    {
      preHandler: [app.authenticate],
      schema: {
        params: SuggestionSchema.SuggestionParamsSchema,
        response: {
          200: SuggestionSchema.SuggestionUndoResponseSchema,
          ...errors
        }
      }
    },
    async (request, reply) => controller.undo(request, reply)
  )
}
