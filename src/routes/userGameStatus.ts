import { FastifyInstance } from 'fastify'
import { UserGameStatusController } from '../controllers/userGameStatus.controller'
import { UserGameStatusService } from '../services/userGameStatus.service'
import { UserGamesStatusRepository } from '../repositories/userGameStatus.repository'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as UserGameStatus from '../schemas/userGameStatus.schema'

const userGamesStatusRepository = new UserGamesStatusRepository()
const userGamesStatusService = new UserGameStatusService(
  userGamesStatusRepository
)
const userGameStatusController = new UserGameStatusController(
  userGamesStatusService
)

export async function userGameStatusRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: {
          200: UserGameStatus.GetGameStatusResponseSchema
        }
      }
    },
    async (request, reply) =>
      userGameStatusController.getAllGameStatus(request, reply)
  )
}
