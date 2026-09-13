import { FastifyReply, FastifyRequest } from 'fastify'
import { ReviewService } from '../services/review.service'
import * as ReviewSchema from '../schemas/review.schema'

export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  async upsertReview(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = ReviewSchema.ReviewParamsSchema.parse(request.params)
    const { text } = ReviewSchema.ReviewBodySchema.parse(request.body)
    const userId = request.user.userId

    const { review } = await this.reviewService.upsertReview(
      igdbId,
      userId,
      text
    )

    return reply.status(200).send({ review })
  }

  async getOwnReview(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = ReviewSchema.ReviewParamsSchema.parse(request.params)
    const userId = request.user.userId

    const { review } = await this.reviewService.findOwnReview(igdbId, userId)

    return reply.status(200).send({ review })
  }

  async deleteReview(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = ReviewSchema.ReviewParamsSchema.parse(request.params)
    const userId = request.user.userId

    await this.reviewService.deleteReview(igdbId, userId)

    return reply.status(204).send()
  }
}
