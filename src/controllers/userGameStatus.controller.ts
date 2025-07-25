import { FastifyReply, FastifyRequest } from 'fastify'
import { UserGameStatusService } from '../services/userGameStatus.service'

export class UserGameStatusController {
  constructor(private userGameStatus: UserGameStatusService) {}

  async getAllGameStatus(request: FastifyRequest, reply: FastifyReply) {
    const { status } = await this.userGameStatus.findAllGameStatus()

    return reply.send({ status })
  }
}
