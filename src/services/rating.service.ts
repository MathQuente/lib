import { ClientError } from '../errors/client-error'
import { GameRepository } from '../repositories/games.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'

export class RatingService {
  constructor(
    private ratingRepository: RatingRepository,
    private userRepository: UserRepository,
    private gameRepository: GameRepository
  ) {}

  async createRating(gameId: string, value: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.')
    }

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    const userGame = await this.userRepository.findUserGame(game.id, user.id)

    const playedStatus = await this.gameRepository.findStatusByName('PLAYED')
    if (!playedStatus) throw new ClientError('Status FINALIZADO')

    if (!userGame?.game || !userGame.UserGamesStatus) {
      await this.userRepository.addGameToUserLibrary({
        gameId,
        userId,
        statusIds: playedStatus.id
      })

      await this.userRepository.createUserGameStats(userId, gameId, 1)

      const rating = await this.ratingRepository.create(game.id, value, user.id)

      return { rating: rating.value }
    }

    const hasPlayed = userGame.UserGamesStatus.id === playedStatus.id
    if (!hasPlayed) {
      await this.userRepository.updateGameStatus(
        gameId,
        userId,
        playedStatus.id
      )

      await this.userRepository.updateUserGamePlayedCount(
        userId,
        userGame.game.id,
        1
      )
    }

    const rating = await this.ratingRepository.create(game.id, value, user.id)

    return { rating: rating.value }
  }

  async findUniqueByUserGame(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.')
    }

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    const rating = await this.ratingRepository.findUniqueByUserGame(
      game.id,
      user.id
    )

    if (!rating) {
      return { rating: null }
    }

    return { rating: rating.value }
  }

  async deleteRating(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.')
    }

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    const existingRating = await this.ratingRepository.findRating(game.id)

    if (!existingRating) {
      throw new ClientError('Already delete rating.')
    }

    const rating = await this.ratingRepository.delete(game.id, user.id)

    return {
      rating
    }
  }

  async findAverageRating(gameId: string) {
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    const average = await this.ratingRepository.findAverageRatingOfGame(gameId)

    return {
      average: average._avg.value || 0
    }
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
}
