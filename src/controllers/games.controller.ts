import { FastifyReply, FastifyRequest } from 'fastify'
import * as GameSchema from '../schemas/game.schema'
import { GameService } from '../services/games.service'

export class GameController {
  constructor(private gameService: GameService) {}

  async createGame(request: FastifyRequest, reply: FastifyReply) {
    const data = GameSchema.GameBodySchema.parse(request.body)

    const { game } = await this.gameService.createGame(data)

    return reply.status(201).send({ game })
  }

  async getGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { game } = await this.gameService.findGameById(gameId)

    return reply.status(200).send({ game })
  }

  async getAllGames(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query, sortBy, sortOrder } =
      GameSchema.GameQueryStringSchema.parse(request.query)

    const { games, total } = await this.gameService.findAllGames(
      pageIndex,
      query,
      sortBy,
      sortOrder
    )

    return reply.status(200).send({ games, total })
  }

  async getFeaturedGames(request: FastifyRequest, reply: FastifyReply) {
    const { mostBeatedsGames, trendingGames, recentGames, futureGames } =
      await this.gameService.findFeaturedGames()

    return reply.send({
      mostBeatedsGames,
      trendingGames,
      recentGames,
      futureGames
    })
  }

  async updateGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)
    const { game: updateData } = GameSchema.UpdateGameBodySchema.parse(
      request.body
    )

    const updated = await this.gameService.updateGame(gameId, updateData)

    return reply.status(200).send({ game: updated })
  }

  async deleteGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { game } = await this.gameService.deleteGame(gameId)

    return reply.send({ game })
  }

  async getSimilarGames(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const similarGames = await this.gameService.findSimilarGames(gameId)

    return reply.send({ similarGames })
  }
}
