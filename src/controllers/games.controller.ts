import { FastifyReply, FastifyRequest } from 'fastify'
import * as GameSchema from '../schemas/game.schema'
import { GameService } from '../services/games.service'

export class GameController {
  constructor(private gameService: GameService) {}

  async createGame(request: FastifyRequest, reply: FastifyReply) {
    const data = GameSchema.GameBodySchema.parse(request.body)

    const { game } = await this.gameService.createGame(data)

    return reply.send({ game })
  }

  async getGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { game } = await this.gameService.findGameById(gameId)

    return reply.send({ game })
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

    return reply.send({ games, total })
  }

  async test(request: FastifyRequest, reply: FastifyReply) {
    const { mostBeateds, gamesTrending, recentGames, futureGames } =
      await this.gameService.findMostBeated()

    return reply.send({ mostBeateds, gamesTrending, recentGames, futureGames })
  }

  async createGameDateRelease(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { dateRelease, platformId } =
      GameSchema.CreateGameDateReleaseBodySchema.parse(request.body)

    const { gameDateRelease } = await this.gameService.createGameDateRelease(
      gameId,
      dateRelease,
      platformId
    )

    return reply.send({ gameDateRelease })
  }

  async updateGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const {
      categories,
      gameBanner,
      gameName,
      gameStudios,
      platforms,
      publishers,
      summary,
      isDlc,
      parentGameId
    } = GameSchema.UpdateGameBodySchema.parse(request.body)

    const { game } = await this.gameService.updateGame(gameId, {
      categories,
      gameBanner,
      gameName,
      gameStudios,
      platforms,
      publishers,
      summary,
      isDlc,
      parentGameId
    })

    return reply.send({ game })
  }

  async deleteGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { game } = await this.gameService.deleteGame(gameId)

    return reply.send({ game })
  }

  async getAllGameStatus(request: FastifyRequest, reply: FastifyReply) {
    const { status } = await this.gameService.findAllGameStatus()

    return reply.send({ status })
  }

  async getSimilarGames(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = GameSchema.GameParamsSchema.parse(request.params)

    const { similarGames } = await this.gameService.findSimilarGames(gameId)

    return reply.send({ similarGames })
  }
}
