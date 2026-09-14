import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { SteamService } from '../services/steam.service'
import { SteamController } from '../controllers/steam.controller'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import * as SteamSchema from '../schemas/steam.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function steamRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameCacheRepository = new GameCacheRepository()
  const gameCacheService = new GameCacheService(gameCacheRepository)
  const steamService = new SteamService(userRepository, gameCacheService)
  const steamController = new SteamController(steamService)

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        body: SteamSchema.ConnectSteamBodySchema,
        response: {
          200: SteamSchema.ConnectSteamResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => steamController.connect(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          202: SteamSchema.StartImportResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => steamController.startImport(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/import',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: SteamSchema.ImportStatusResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => steamController.getImportStatus(request, reply)
  )
}
