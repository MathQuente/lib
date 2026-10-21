import { ClientError } from '../errors/client-error'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'

const PLAYED_STATUS_ID = 1
const PLAYING_STATUS_ID = 3
const WISHLIST_STATUS_ID = 5

export class RatingService {
  constructor(
    private ratingRepository: RatingRepository,
    private userRepository: UserRepository,
    private gameCacheService: GameCacheService
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async createRating(igdbId: number, value: number, userId: string) {
    await this.requireUser(userId)

    const gameExists = await this.gameCacheService.ensureCached(igdbId)
    if (!gameExists) throw new ClientError('Jogo não encontrado.', 404)

    const { suggestsEndless } =
      await this.gameCacheService.assertReleased(igdbId)

    const userGame = await this.userRepository.findUserGame(igdbId, userId)
    let promotedToPlayed = false
    let addedAsPlaying = false

    if (!userGame || userGame.UserGamesStatus.id === WISHLIST_STATUS_ID) {
      const endless = userGame?.endlessLocked
        ? userGame.endless
        : suggestsEndless
      const statusId = endless ? PLAYING_STATUS_ID : PLAYED_STATUS_ID

      if (!userGame) {
        await this.userRepository.addGameToUserLibrary({
          igdbId,
          userId,
          statusIds: statusId,
          ...(endless ? { endless } : {})
        })
        await this.userRepository.createUserGameStats(
          userId,
          igdbId,
          endless ? 0 : 1
        )
      } else {
        await this.userRepository.updateGameStatus(igdbId, userId, statusId, {
          endless
        })
        if (!endless) {
          await this.userRepository.updateUserGamePlayedCount(userId, igdbId, 1)
        }
      }

      addedAsPlaying = endless
      promotedToPlayed = !endless
    }

    const rating = await this.ratingRepository.create(igdbId, value, userId)

    return { rating: rating.value, promotedToPlayed, addedAsPlaying }
  }

  async findUniqueByUserGame(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const rating = await this.ratingRepository.findUniqueByUserGame(
      igdbId,
      userId
    )

    return { rating: rating?.value ?? null }
  }

  async deleteRating(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const existingRating = await this.ratingRepository.findUniqueByUserGame(
      igdbId,
      userId
    )

    if (!existingRating) {
      throw new ClientError('Avaliação não encontrada.', 404)
    }

    return this.ratingRepository.delete(igdbId, userId)
  }

  async findAverageRating(igdbId: number) {
    const average = await this.ratingRepository.findAverageRatingOfGame(igdbId)
    return { average: average._avg.value || 0 }
  }

  async findManyRating(pageIndex = 0, limit = 20) {
    const ratings = await this.ratingRepository.findManyRating({
      pageIndex,
      limit
    })

    return {
      ratings: ratings.map(({ user, value }) => ({
        user: {
          id: user.id,
          userName: user.userName,
          profilePicture: user.profilePicture
        },
        value
      }))
    }
  }

  async findRatingDistribution(igdbId: number) {
    const ratings = await this.ratingRepository.findRatingDistribution(igdbId)

    return {
      ratings: ratings.map(rating => ({
        rating: rating.value,
        count: rating._count.value
      }))
    }
  }

  async countRatingsByGame(igdbId: number) {
    const ratings = await this.ratingRepository.countRatingsByGame(igdbId)
    return { ratings }
  }
}
