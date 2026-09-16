import { FastifyReply, FastifyRequest } from 'fastify'
import { FollowService } from '../services/follow.service'
import * as FollowSchema from '../schemas/follow.schema'

export class FollowController {
  constructor(private followService: FollowService) {}

  async follow(request: FastifyRequest, reply: FastifyReply) {
    const { userId: targetId } = FollowSchema.FollowParamsSchema.parse(
      request.params
    )
    const userId = request.user.userId

    await this.followService.follow(userId, targetId)

    return reply.status(204).send()
  }

  async unfollow(request: FastifyRequest, reply: FastifyReply) {
    const { userId: targetId } = FollowSchema.FollowParamsSchema.parse(
      request.params
    )
    const userId = request.user.userId

    await this.followService.unfollow(userId, targetId)

    return reply.status(204).send()
  }

  async getFollowStatus(request: FastifyRequest, reply: FastifyReply) {
    const { userId: targetId } = FollowSchema.FollowParamsSchema.parse(
      request.params
    )
    const userId = request.user.userId

    const result = await this.followService.isFollowing(userId, targetId)

    return reply.status(200).send(result)
  }
}
