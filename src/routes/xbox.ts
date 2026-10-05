import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { XboxService } from '../services/xbox.service'
import { XboxController } from '../controllers/xbox.controller'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { XboxApiService } from '../services/xbox-api.service'
import * as XboxSchema from '../schemas/xbox.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function xboxRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameCacheRepository = new GameCacheRepository()
  const gameCacheService = new GameCacheService(gameCacheRepository)
  const xboxService = new XboxService(
    userRepository,
    gameCacheService,
    new XboxApiService()
  )
  const xboxController = new XboxController(xboxService)

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        body: XboxSchema.ConnectXboxBodySchema,
        response: {
          200: XboxSchema.ConnectXboxResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError,
          502: ErrorSchemas.InternalServerError,
          503: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => xboxController.connect(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          204: XboxSchema.DisconnectResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => xboxController.disconnect(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          202: XboxSchema.StartImportResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          429: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => xboxController.startImport(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: XboxSchema.ImportStatusResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => xboxController.getImportStatus(request, reply)
  )
}
