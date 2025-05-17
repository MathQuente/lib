import { FastifyReply, FastifyRequest } from 'fastify'
import { GameStudioService } from '../services/gameStudios.service'
import * as GameStudioSchemas from '../schemas/gameStudio.schema'

export class GameStudioController {
  constructor(private gameStudioController: GameStudioService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { studioName } = GameStudioSchemas.GameStudioBodySchema.parse(
      request.body
    )

    const { gameStudio } = await this.gameStudioController.createGameStudio(
      studioName
    )

    return reply.send({ gameStudio })
  }

  async getStudio(request: FastifyRequest, reply: FastifyReply) {
    const { gameStudioId } = GameStudioSchemas.GameStudioParamsSchema.parse(
      request.params
    )

    const { pageIndex } = GameStudioSchemas.GameStudioQueryStringSchema.parse(
      request.query
    )

    const gameStudio = await this.gameStudioController.getStudioById(
      gameStudioId,
      pageIndex
    )

    return reply.send({ gameStudio })
  }

  async getStudios(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex } = GameStudioSchemas.GameStudioQueryStringSchema.parse(
      request.query
    )

    const { gameStudios } = await this.gameStudioController.getAllStudios(
      pageIndex
    )

    return reply.send({ gameStudios })
  }

  async updateStudio(request: FastifyRequest, reply: FastifyReply) {
    const { gameStudioId } = GameStudioSchemas.GameStudioParamsSchema.parse(
      request.params
    )
    const { studioName } = GameStudioSchemas.GameStudioBodySchema.parse(
      request.body
    )

    const { gameStudio } = await this.gameStudioController.updateStudio(
      gameStudioId,
      studioName
    )

    return reply.send({ gameStudio })
  }

  async deleteStudio(request: FastifyRequest, reply: FastifyReply) {
    const { gameStudioId } = GameStudioSchemas.GameStudioParamsSchema.parse(
      request.params
    )

    const { gameStudio } = await this.gameStudioController.deleteStudio(
      gameStudioId
    )

    return reply.send({ gameStudio })
  }
}
