import { FastifyReply, FastifyRequest } from 'fastify'
import * as DlcSchema from '../schemas/dlcs.schema'
import * as GameSchema from '../schemas/games.schema'
import { DlcService } from '../services/dlcs.service'

export class DlcController {
  constructor(private dlcService: DlcService) {}

  async createDlc(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)
    const {
      categories,
      dlcBanner,
      dlcName,
      gameStudios,
      platforms,
      publishers,
      summary
    } = DlcSchema.CreateDlcBodySchema.parse(request.body)

    const { dlc } = await this.dlcService.createDlc(gameId, {
      categories,
      dlcBanner,
      dlcName,
      gameStudios,
      platforms,
      publishers,
      summary
    })

    return reply.send({ dlc })
  }
}
