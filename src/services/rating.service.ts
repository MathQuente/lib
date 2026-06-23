import { ClientError } from '../errors/client-error'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'

const PLAYED_STATUS_ID = 1

export class RatingService {
  constructor(
    private ratingRepository: RatingRepository,
    private userRepository: UserRepository
  ) {}

  async createRating(igdbId: number, value: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const userGame = await this.userRepository.findUserGame(igdbId, userId)

    if (!userGame) {
      await this.userRepository.addGameToUserLibrary({
        igdbId,
        userId,
        statusIds: PLAYED_STATUS_ID
      })

      await this.userRepository.createUserGameStats(userId, igdbId, 1)
    } else if (userGame.UserGamesStatus.id !== PLAYED_STATUS_ID) {
      await this.userRepository.updateGameStatus(
        igdbId,
        userId,
        PLAYED_STATUS_ID
      )
      await this.userRepository.updateUserGamePlayedCount(userId, igdbId, 1)
    }

    const rating = await this.ratingRepository.create(igdbId, value, userId)

    return { rating: rating.value }
  }

  async findUniqueByUserGame(igdbId: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.')
    }

    const rating = await this.ratingRepository.findUniqueByUserGame(
      igdbId,
      userId
    )

    return { rating: rating?.value ?? null }
  }

  async deleteRating(igdbId: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.')
    }

    const existingRating = await this.ratingRepository.findUniqueByUserGame(
      igdbId,
      userId
    )

    if (!existingRating) {
      throw new ClientError('Rating not found.', 404)
    }

    return this.ratingRepository.delete(igdbId, userId)
  }

  async findAverageRating(igdbId: number) {
    const average = await this.ratingRepository.findAverageRatingOfGame(igdbId)
    return { average: average._avg.value || 0 }
  }

  async findManyRating() {
    const ratings = await this.ratingRepository.findManyRating()

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

  async countRatingByName(igdbId: number) {
    const rating = await this.ratingRepository.countRatingByName(igdbId)
    return { ratings: rating.value }
  }
}
