import { ClientError } from '../errors/client-error'
import { ReviewRepository } from '../repositories/review.repository'
import { UserRepository } from '../repositories/users.repository'
import { RatingRepository } from '../repositories/rating.repository'

const PLAYED_STATUS_ID = 1

export class ReviewService {
  constructor(
    private reviewRepository: ReviewRepository,
    private userRepository: UserRepository,
    private ratingRepository: RatingRepository
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async upsertReview(igdbId: number, userId: string, text: string) {
    await this.requireUser(userId)

    const existing = await this.reviewRepository.findByUserGame(igdbId, userId)

    if (!existing) {
      const userGame = await this.userRepository.findUserGameStatus(
        igdbId,
        userId
      )
      if (!userGame) {
        throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
      }
      if (userGame.UserGamesStatus?.id !== PLAYED_STATUS_ID) {
        throw new ClientError(
          'Você só pode escrever uma resenha de um jogo marcado como Jogado.',
          400
        )
      }

      const rating = await this.ratingRepository.findUniqueByUserGame(
        igdbId,
        userId
      )
      if (!rating) {
        throw new ClientError(
          'Você precisa avaliar este jogo antes de escrever uma resenha.',
          400
        )
      }
    }

    const review = await this.reviewRepository.upsert(userId, igdbId, text)

    return { review: { text: review.text, updatedAt: review.updatedAt } }
  }

  async findOwnReview(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const review = await this.reviewRepository.findByUserGame(igdbId, userId)

    return {
      review: review ? { text: review.text, updatedAt: review.updatedAt } : null
    }
  }

  async deleteReview(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const existing = await this.reviewRepository.findByUserGame(igdbId, userId)
    if (!existing) throw new ClientError('Resenha não encontrada.', 404)

    await this.reviewRepository.delete(userId, igdbId)
  }

  private readonly COMMUNITY_REVIEWS_PER_PAGE = 10

  async findCommunityReviews(
    igdbId: number,
    pageIndex: number,
    limit = this.COMMUNITY_REVIEWS_PER_PAGE
  ) {
    const [reviews, total] = await Promise.all([
      this.reviewRepository.findCommunityReviews({
        igdbId,
        skip: pageIndex * limit,
        take: limit
      }),
      this.reviewRepository.countCommunityReviews(igdbId)
    ])

    return {
      reviews: reviews.map(r => ({
        userId: r.userId,
        userName: r.userName,
        profilePicture: r.profilePicture,
        rating: r.rating,
        hoursPlayed: r.hoursPlayed,
        completions: r.completions,
        text: r.text,
        createdAt: r.createdAt
      })),
      total
    }
  }
}
