import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { PsnService } from '../services/psn.service'
import { PsnController } from '../controllers/psn.controller'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { PsnApiService } from '../services/psn-api.service'
import { PsnAuthService } from '../services/psn-auth.service'
import { CacheRepository } from '../repositories/cache.repository'
import * as PsnSchema from '../schemas/psn.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function psnRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameCacheRepository = new GameCacheRepository()
  const gameCacheService = new GameCacheService(gameCacheRepository)
  const psnApiService = new PsnApiService(
    new PsnAuthService(new CacheRepository())
  )
  const psnService = new PsnService(
    userRepository,
    gameCacheService,
    psnApiService
  )
  const psnController = new PsnController(psnService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/verification',
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: PsnSchema.ConnectPsnBodySchema,
        response: {
          200: PsnSchema.StartPsnVerificationResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => psnController.startVerification(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/',
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: PsnSchema.ConnectPsnResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => psnController.connect(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          204: PsnSchema.DisconnectResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => psnController.disconnect(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          202: PsnSchema.StartImportResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => psnController.startImport(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: PsnSchema.ImportStatusResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => psnController.getImportStatus(request, reply)
  )
}
