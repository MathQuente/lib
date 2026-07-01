import { FastifyReply, FastifyRequest } from 'fastify'
import * as GameSchema from '../schemas/game.schema'
import { GameService } from '../services/games.service'

export class GameController {
  constructor(private gameService: GameService) {}

  async getGame(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = GameSchema.GameParamsSchema.parse(request.params)

    const { game, relatedGames } = await this.gameService.findGameById(igdbId)

    return reply.status(200).send({ game, relatedGames })
  }

  async getAllGames(request: FastifyRequest, reply: FastifyReply) {
    const { query, limit, pageIndex, sortBy, sortOrder } = GameSchema.GameQueryStringSchema.parse(
      request.query
    )

    const { games, total } = await this.gameService.findAllGames(query, limit, pageIndex, sortBy, sortOrder)

    return reply.status(200).send({ games, total })
  }

  async getFeaturedGames(request: FastifyRequest, reply: FastifyReply) {
    const { mostRatedGames, trendingGames, recentGames, futureGames } =
      await this.gameService.findFeaturedGames()

    return reply.send({ mostRatedGames, trendingGames, recentGames, futureGames })
  }

  async getSimilarGames(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = GameSchema.GameParamsSchema.parse(request.params)

    const similarGames = await this.gameService.findSimilarGames(igdbId)

    return reply.send({ similarGames })
  }

  async getComingSoonGames(request: FastifyRequest, reply: FastifyReply) {
    const { limit, pageIndex } = GameSchema.ComingSoonQueryStringSchema.parse(request.query)

    const { games, total } = await this.gameService.findComingSoonGames(limit, pageIndex)

    return reply.send({ games, total })
  }
}
