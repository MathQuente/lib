import { ClientError } from '../errors/client-error'
import { ReviewRepository } from '../repositories/review.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'

const PLAYED_STATUS_ID = 1
const PAUSED_STATUS_ID = 2
const PLAYING_STATUS_ID = 3
const BACKLOG_STATUS_ID = 4
const DROPPED_STATUS_ID = 6

const REVIEWABLE_STATUS_IDS = [
  PLAYED_STATUS_ID,
  PAUSED_STATUS_ID,
  PLAYING_STATUS_ID,
  DROPPED_STATUS_ID
]

export class ReviewService {
  constructor(
    private reviewRepository: ReviewRepository,
    private userRepository: UserRepository,
    private gameCacheService: GameCacheService
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
        throw new ClientError(
          'Adicione o jogo à sua biblioteca para escrever uma resenha.',
          404
        )
      }

      await this.gameCacheService.assertReleased(igdbId)

      const statusId = userGame.UserGamesStatus?.id as number
      const stats = userGame.UserGameStats
      const hasExperience =
        Number(stats?.hoursPlayed ?? 0) > 0 || (stats?.completions ?? 0) > 0
      const canReview =
        REVIEWABLE_STATUS_IDS.includes(statusId) ||
        (statusId === BACKLOG_STATUS_ID && hasExperience)
      if (!canReview) {
        throw new ClientError(
          'Você só pode escrever uma resenha de um jogo que já começou (Jogado, Jogando, Pausado ou Larguei) ou de um jogo na sua fila com horas ou finalizações registradas.',
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
        status: r.status,
        endless: r.endless,
        text: r.text,
        createdAt: r.createdAt
      })),
      total
    }
  }
}
