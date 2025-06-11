import { UpdateUserDTO } from '../dtos/user.dto'
import { ClientError } from '../errors/client-error'

import { GameRepository } from '../repositories/games.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'

export class UserService {
  private readonly ITEMS_PER_PAGE = 30

  constructor(
    private userRepository: UserRepository,
    private gameRepository: GameRepository,
    private ratingRepository: RatingRepository
  ) {}

  async addGameToUserLibrary(
    gameId: string,
    userId: string,
    statusIds: number[]
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found - game not exists with this ID')
    }

    const gameHasBeenAlreadyAddtoUserLibrary =
      await this.userRepository.findUserGame(gameId, userId)

    if (gameHasBeenAlreadyAddtoUserLibrary) {
      throw new ClientError('This game is already in your library')
    }

    const selectedStatuses = await this.userRepository.findManyByIds(statusIds)

    const isPlayed = selectedStatuses.some(status => status.status === 'PLAYED')

    const { game } = await this.userRepository.addGameToUserLibrary({
      gameId,
      statusIds,
      userId
    })

    await this.userRepository.createUserGameStats(
      userId,
      gameId,
      isPlayed ? 1 : 0
    )

    return { game }
  }

  async delete(userId: string) {
    const userAlreadyDeleted = await this.userRepository.findUserById(userId)

    if (!userAlreadyDeleted) {
      throw new ClientError('This user has been deleted.')
    }

    const user = await this.userRepository.deleteUser(userId)

    return {
      user
    }
  }

  async findMe(userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    return {
      user: {
        id: user.id,
        profilePicture: user.profilePicture,
        userName: user.userName,
        userBanner: user.userBanner,
        gamesAmount: user._count.userGames
      }
    }
  }

  async findById(userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const gamesAmount = await this.userRepository.countUserGames(userId)

    return {
      user: {
        id: user.id,
        email: user.email,
        profilePicture: user.profilePicture,
        userBanner: user.userBanner,
        userName: user.userName,
        gamesAmount: gamesAmount?._count.userGames
      }
    }
  }

  async findUserGameStatus(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    const userGameStatuses = await this.userRepository.findUserGameStatus(
      gameId,
      userId
    )

    return {
      userGameStatuses: userGameStatuses?.statuses || []
    }
  }

  async findManyUsers(pageIndex: number, query: string | undefined) {
    const users = await this.userRepository.findManyUsers({
      pageIndex,
      limit: this.ITEMS_PER_PAGE,
      query
    })

    return {
      users: users.map(user => ({
        id: user.id,
        userBanner: user.userBanner,
        userName: user.userName,
        profilePicture: user.profilePicture,
        userGamesAmount: user._count.userGames
      }))
    }
  }

  async findManyUserGames(
    userId: string,
    pageIndex: number,
    filter: number | undefined,
    query: string | undefined
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const rawUserGames = await this.userRepository.findManyGamesOfUser(
      userId,
      filter,
      {
        pageIndex,
        query,
        limit: this.ITEMS_PER_PAGE
      }
    )

    const userGames = rawUserGames.map(item => ({
      id: item.game?.id,
      gameName: item.game?.gameName,
      gameBanner: item.game?.gameBanner,
      isDlc: item.game?.isDlc,
      statuses: item.statuses.map(status => status.status)
    }))

    const totalPerStatus = await this.userRepository.findGamesCountByStatus(
      userId
    )

    const formattedTotalPerStatus = totalPerStatus.map(item => ({
      status: item.status, // Extraindo o statusId
      totalGames: item._count.userGames // Contando os jogos por status
    }))

    return {
      userGames,
      totalPerStatus: formattedTotalPerStatus,
      totalGames: userGames.length
    }
  }

  async removeGame(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found. Game not exists with this ID')
    }

    const gameHasBeenAlreadyRemovedtoUserLibrary =
      await this.userRepository.findUserGame(gameId, userId)

    if (!gameHasBeenAlreadyRemovedtoUserLibrary) {
      throw new ClientError('This game is removed from your library')
    }

    const { game } = await this.userRepository.removeGame(gameId, userId)

    const rating = await this.ratingRepository.findUniqueByUserGame(
      gameId,
      userId
    )

    if (rating) {
      await this.ratingRepository.delete(gameId, userId)
    }

    return { game }
  }

  async updateGame(gameId: string, userId: string, statusIds: number[]) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const existingGame = this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found. Game not DLC exists with this ID')
    }

    const userGame = await this.userRepository.findUserGame(gameId, userId)

    if (!userGame?.game) {
      throw new ClientError(
        'This game is not in your library, you cant update.'
      )
    }

    const userGamePlayedCountUpdated =
      await this.userRepository.updateUserGamePlayedCount(
        userId,
        userGame.game.id,
        1
      )

    const { game, statuses } = await this.userRepository.updateGameStatus(
      gameId,
      userId,
      statusIds
    )

    return { game, statuses, userGamePlayedCountUpdated }
  }

  async update(userId: string, data: UpdateUserDTO) {
    const userAlreadyExist = await this.userRepository.findUserById(userId)

    if (!userAlreadyExist) {
      throw new ClientError('This user has not found.')
    }

    const user = await this.userRepository.updateUser(userId, {
      profilePicture: data.profilePicture,
      userBanner: data.userBanner,
      userName: data.userName
    })

    return { user }
  }

  async findUserGameStats(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found. Game not exists with this ID')
    }

    const userGameStats = await this.userRepository.findUserGameStats(
      gameId,
      userId
    )

    return {
      userGameStats: userGameStats || { completions: 0 }
    }
  }

  async updateUserGamePlayedCount(
    userId: string,
    gameId: string,
    incrementValue: number
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found. Game not exists with this ID')
    }

    const { userGameStatuses } = await this.findUserGameStatus(gameId, userId)

    if (userGameStatuses) {
      const gameFounded = userGameStatuses.find(
        gameStatus => gameStatus.status == 'REPLAYING'
      )

      if (gameFounded) {
        await this.userRepository.updateGameStatus(existingGame.id, userId, [1])
      }
    }

    const userGameStats = await this.userRepository.updateUserGamePlayedCount(
      userId,
      existingGame.id,
      incrementValue
    )

    return { userGameStats }
  }
}
