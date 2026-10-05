import { FastifyReply, FastifyRequest } from 'fastify'
import { PsnService } from '../services/psn.service'
import * as PsnSchema from '../schemas/psn.schema'

export class PsnController {
  constructor(private psnService: PsnService) {}

  async startVerification(request: FastifyRequest, reply: FastifyReply) {
    const { onlineId } = PsnSchema.ConnectPsnBodySchema.parse(request.body)
    const userId = request.user.userId

    const result = await this.psnService.startPsnVerification(userId, onlineId)

    return reply.status(200).send(result)
  }

  async connect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.psnService.connectPsn(userId)

    return reply.status(200).send(result)
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    await this.psnService.disconnectPsn(userId)

    return reply.status(204).send()
  }

  async startImport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.psnService.enqueueImport(userId)

    return reply.status(202).send(result)
  }

  async getImportStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.psnService.getImportStatus(userId)

    return reply.status(200).send(result)
  }
}
