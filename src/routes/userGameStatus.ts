import { FastifyInstance } from 'fastify'
import { UserGameStatusController } from '../controllers/userGameStatus.controller'
import { UserGameStatusService } from '../services/userGameStatus.service'
import { UserGamesStatusRepository } from '../repositories/userGameStatus.repository'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as UserGameStatus from '../schemas/userGameStatus.schema'
import { ErrorSchemas } from '../schemas/error.schema'

export async function userGameStatusRoutes(app: FastifyInstance) {
  const userGamesStatusRepository = new UserGamesStatusRepository()
  const userGamesStatusService = new UserGameStatusService(
    userGamesStatusRepository
  )
  const userGameStatusController = new UserGameStatusController(
    userGamesStatusService
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: {
          200: UserGameStatus.GetGameStatusResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      userGameStatusController.getAllGameStatus(request, reply)
  )
}
