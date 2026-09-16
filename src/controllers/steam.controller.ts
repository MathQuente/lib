import { FastifyReply, FastifyRequest } from 'fastify'
import { SteamService } from '../services/steam.service'
import * as SteamSchema from '../schemas/steam.schema'

export class SteamController {
  constructor(private steamService: SteamService) {}

  async connect(request: FastifyRequest, reply: FastifyReply) {
    const { profileInput } = SteamSchema.ConnectSteamBodySchema.parse(
      request.body
    )
    const userId = request.user.userId

    const result = await this.steamService.connectSteam(userId, profileInput)

    return reply.status(200).send(result)
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    await this.steamService.disconnectSteam(userId)

    return reply.status(204).send()
  }

  async startImport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.steamService.enqueueImport(userId)

    return reply.status(202).send(result)
  }

  async getImportStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.steamService.getImportStatus(userId)

    return reply.status(200).send(result)
  }
}
