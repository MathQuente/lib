import { FastifyReply, FastifyRequest } from 'fastify'
import { RatingService } from '../services/rating.service'
import * as RatingSchema from '../schemas/rating.schema'

export class RatingController {
  constructor(private ratingService: RatingService) {}

  async createRatingToGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const { value } = RatingSchema.RatingBodySchema.parse(request.body)

    const userId = request.user.userId

    const { rating } = await this.ratingService.createRating(
      gameId,
      value,
      userId
    )

    return reply.status(201).send({ rating })
  }

  async getUserGameRating(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { rating } = await this.ratingService.findUniqueByUserGame(
      gameId,
      userId
    )

    return reply.send({ rating })
  }

  async getAverageRatingOfGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const { average } = await this.ratingService.findAverageRating(gameId)

    return reply.send({ average })
  }

  async deleteRating(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const userId = request.user.userId

    await this.ratingService.deleteRating(gameId, userId)

    return reply.status(204).send()
  }

  async getAllRatings(request: FastifyRequest, reply: FastifyReply) {
    const { ratings } = await this.ratingService.findManyRating()

    return reply.send({ ratings })
  }

  async getRatingDistribution(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const { ratings } = await this.ratingService.findRatingDistribution(gameId)

    return reply.send({ ratings })
  }

  async getManyRatingByGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = RatingSchema.RatingParamsSchema.parse(request.params)

    const { ratings } = await this.ratingService.findManyByGame(gameId)

    return reply.send({ ratings })
  }
}
