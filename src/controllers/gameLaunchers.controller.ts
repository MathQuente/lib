import { FastifyReply, FastifyRequest } from 'fastify'
import { GameLauncherService } from '../services/gameLaunchers.service'
import * as GameSchema from '../schemas/game.schema'

export class GameLauncherController {
  constructor(private gameLauncherService: GameLauncherService) {}
  async createGameDateRelease(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { dateRelease, platformId } =
      GameSchema.CreateGameDateReleaseBodySchema.parse(request.body)

    const { gameDateRelease } =
      await this.gameLauncherService.createGameDateRelease(
        gameId,
        dateRelease,
        platformId
      )

    return reply.status(201).send({ gameDateRelease })
  }
}
