import { FastifyReply, FastifyRequest } from 'fastify'
import { UserGamePlatformService } from '../services/user-game-platform.service'
import * as UserSchema from '../schemas/user.schema'

export class UserGamePlatformController {
  constructor(private userGamePlatformService: UserGamePlatformService) {}

  async getPlatforms(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId

    const result = await this.userGamePlatformService.getPlatforms(
      userId,
      igdbId
    )

    return reply.status(200).send(result)
  }

  async addPlatform(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId, platform } = UserSchema.UserGamePlatformParamsSchema.parse(
      request.params
    )
    const userId = request.user.userId

    const result = await this.userGamePlatformService.addPlatform(
      userId,
      igdbId,
      platform
    )

    return reply.status(200).send(result)
  }

  async updatePlatform(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId, platform } = UserSchema.UserGamePlatformParamsSchema.parse(
      request.params
    )
    const patch = UserSchema.UserGamePlatformUpdateBodySchema.parse(
      request.body
    )
    const userId = request.user.userId

    const result = await this.userGamePlatformService.updatePlatform(
      userId,
      igdbId,
      platform,
      patch
    )

    return reply.status(200).send(result)
  }

  async removePlatform(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId, platform } = UserSchema.UserGamePlatformParamsSchema.parse(
      request.params
    )
    const userId = request.user.userId

    const result = await this.userGamePlatformService.removePlatform(
      userId,
      igdbId,
      platform
    )

    return reply.status(200).send(result)
  }
}
