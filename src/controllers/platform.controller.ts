import { FastifyReply, FastifyRequest } from 'fastify'
import { PlatformService } from '../services/platform.service'
import * as PlatformSchemas from '../schemas/platform.schema'

export class PlatformController {
  constructor(private platformService: PlatformService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    // get platformName from request.body
    const { platformName } = PlatformSchemas.PlatformBodySchema.parse(
      request.body
    )

    // get platformId from request.params
    const { platform } = await this.platformService.createPlatform(platformName)

    // return object platform
    return reply.send({ platform })
  }

  async getPlatform(request: FastifyRequest, reply: FastifyReply) {
    const { platformId } = PlatformSchemas.PlatformParamsSchema.parse(
      request.params
    )

    // get platform
    const { platform } = await this.platformService.getPlatformById(platformId)

    return reply.send({ platform })
  }

  async getPlatforms(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex } = PlatformSchemas.PlatformQueryStringSchema.parse(
      request.query
    )

    // get all platforms
    const { platforms } = await this.platformService.getAllPlatforms(pageIndex)

    return reply.send({ platforms })
  }

  async updatePlatform(request: FastifyRequest, reply: FastifyReply) {
    const { platformName } = PlatformSchemas.PlatformBodySchema.parse(
      request.body
    )

    const { platformId } = PlatformSchemas.PlatformParamsSchema.parse(
      request.params
    )

    const { platform } = await this.platformService.updatePlatofrm(
      platformId,
      platformName
    )

    return reply.send({ platform })
  }

  async deletePlatform(request: FastifyRequest, reply: FastifyReply) {
    const { platformId } = PlatformSchemas.PlatformParamsSchema.parse(
      request.params
    )

    const { platform } = await this.platformService.deletePlatform(platformId)

    return reply.send({ platform })
  }
}
