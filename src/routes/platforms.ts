import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { PlatformController } from '../controllers/platform.controller'
import { PlatformService } from '../services/platform.service'
import { PlatformRepository } from '../repositories/platform.repository'
import * as PlatformSchemas from '../schemas/platform.schema'
export async function platformsRoutes(app: FastifyInstance) {
  const platformRepository = new PlatformRepository()
  const platformService = new PlatformService(platformRepository)
  const platformController = new PlatformController(platformService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: PlatformSchemas.PlatformBodySchema,
        response: {
          201: PlatformSchemas.CreatePlatformResponseSchema
        }
      }
    },
    async (request, reply) => platformController.create(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:platformId',
    {
      schema: {
        params: PlatformSchemas.PlatformParamsSchema,
        response: {
          200: PlatformSchemas.GetPlatformResponseSchema
        }
      }
    },
    async (request, reply) => platformController.getPlatform(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: PlatformSchemas.PlatformQueryStringSchema,
        response: {
          200: PlatformSchemas.GetAllPlatformsResponseSchema
        }
      }
    },
    async (request, reply) => platformController.getPlatforms(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:platformId',
    {
      schema: {
        params: PlatformSchemas.PlatformParamsSchema,
        response: {
          200: PlatformSchemas.DeletePlatformResponseSchema
        }
      }
    },
    async (request, reply) => platformController.deletePlatform(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:platformId',
    {
      schema: {
        params: PlatformSchemas.PlatformParamsSchema,
        body: PlatformSchemas.PlatformBodySchema,
        response: {
          200: PlatformSchemas.UpdatedPlatformResponseSchema
        }
      }
    },
    async (request, reply) => platformController.updatePlatform(request, reply)
  )
}
