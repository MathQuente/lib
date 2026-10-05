import { FastifyReply, FastifyRequest } from 'fastify'
import { XboxService } from '../services/xbox.service'
import * as XboxSchema from '../schemas/xbox.schema'

export class XboxController {
  constructor(private xboxService: XboxService) {}

  async connect(request: FastifyRequest, reply: FastifyReply) {
    const { gamertag } = XboxSchema.ConnectXboxBodySchema.parse(request.body)
    const userId = request.user.userId

    const result = await this.xboxService.connectXbox(userId, gamertag)

    return reply.status(200).send(result)
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    await this.xboxService.disconnectXbox(userId)

    return reply.status(204).send()
  }

  async startImport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.xboxService.enqueueImport(userId)

    return reply.status(202).send(result)
  }

  async getImportStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.xboxService.getImportStatus(userId)

    return reply.status(200).send(result)
  }
}
