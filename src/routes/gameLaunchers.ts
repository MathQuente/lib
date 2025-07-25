import { FastifyInstance } from 'fastify'
import { GameLauncherController } from '../controllers/gameLaunchers.controller'
import { GameLauncherService } from '../services/gameLaunchers.service'
import { PlatformRepository } from '../repositories/platforms.repository'
import { GameRepository } from '../repositories/games.repository'
import { GameLauncherRepository } from '../repositories/gameLaunchers.repository'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as GameLauncherSchema from '../schemas/gameLauncher.schema'
import { ErrorSchemas } from '../schemas/error.schema'

const gameLauncherRepository = new GameLauncherRepository()
const gameRepository = new GameRepository()
const platformRepository = new PlatformRepository()
const gameLauncherService = new GameLauncherService(
  gameRepository,
  platformRepository,
  gameLauncherRepository
)
const gameController = new GameLauncherController(gameLauncherService)

export async function gameLaunchersRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/:gameId/releases',
    {
      schema: {
        params: GameLauncherSchema.CreateReleaseParamsSchema,
        body: GameLauncherSchema.CreateGameDateReleaseBodySchema,
        response: {
          201: GameLauncherSchema.CreateGameDateReleaseResponseSchema,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      gameController.createGameDateRelease(request, reply)
  )
}
