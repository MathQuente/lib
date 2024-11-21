import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as GameStudioSchemas from '../schemas/gameStudio.schema'
import { GameStudioRepository } from '../repositories/gameStudio.repository'
import { GameStudioService } from '../services/gameStudio.service'
import { GameStudioController } from '../controllers/gameStudio.controller'

export async function gameStudioRoutes(app: FastifyInstance) {
  const gameStudioRepository = new GameStudioRepository()
  const gameStudioService = new GameStudioService(gameStudioRepository)
  const gameStudioController = new GameStudioController(gameStudioService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: GameStudioSchemas.GameStudioBodySchema,
        response: {
          201: GameStudioSchemas.CreateGameStudioResponseSchema
        }
      }
    },
    async (request, reply) => gameStudioController.create(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:gameStudioId',
    {
      schema: {
        querystring: GameStudioSchemas.GameStudioQueryStringSchema,
        params: GameStudioSchemas.GameStudioParamsSchema,
        response: {
          200: GameStudioSchemas.GetStudioResponseSchema
        }
      }
    },
    async (request, reply) => gameStudioController.getStudio(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: GameStudioSchemas.GameStudioQueryStringSchema,
        response: {
          200: GameStudioSchemas.GetAllStudiosResponseSchema
        }
      }
    },
    async (request, reply) => gameStudioController.getStudios(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:gameStudioId',
    {
      schema: {
        params: GameStudioSchemas.GameStudioParamsSchema,
        response: {
          200: GameStudioSchemas.DeleteStudioResponseSchema
        }
      }
    },
    async (request, reply) => gameStudioController.deleteStudio(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:gameStudioId',
    {
      schema: {
        params: GameStudioSchemas.GameStudioParamsSchema,
        body: GameStudioSchemas.GameStudioBodySchema,
        response: {
          200: GameStudioSchemas.UpdateStudioResponseSchema
        }
      }
    },
    async (request, reply) => gameStudioController.updateStudio(request, reply)
  )
}
