import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { GameRepository } from '../repositories/games.repository'
import * as DlcSchema from '../schemas/dlcs.schema'
import * as GameSchema from '../schemas/games.schema'
import { DlcRepository } from '../repositories/dlcs.repository'
import { DlcService } from '../services/dlcs.service'
import { DlcController } from '../controllers/dlcs.controller'

const dlcRepository = new DlcRepository()
const gameRepository = new GameRepository()
const dlcService = new DlcService(dlcRepository, gameRepository)
const dlcController = new DlcController(dlcService)

export async function dlcsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameId/dlc',
    {
      schema: {
        params: GameSchema.GameParamsSchema,
        body: DlcSchema.CreateDlcBodySchema,
        response: {
          201: DlcSchema.CreateDlcResponseSchema
        }
      }
    },
    async (request, reply) => dlcController.createDlc(request, reply)
  )
}
