import { Status } from '@prisma/client'
import { UpdateUserDTO } from '../dtos/user.dto'
import { ClientError } from '../errors/client-error'

import { GameRepository } from '../repositories/games.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { Game } from '../types/game'
import { randomInt } from 'crypto'

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
    statusIds: number
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found.', 404)
    }

    const gameHasBeenAlreadyAddtoUserLibrary =
      await this.userRepository.findUserGame(gameId, userId)

    if (gameHasBeenAlreadyAddtoUserLibrary) {
      throw new ClientError('This game is already in your library', 409)
    }

    const { game } = await this.userRepository.addGameToUserLibrary({
      gameId,
      statusIds,
      userId
    })

    await this.userRepository.createUserGameStats(userId, gameId)

    return { game }
  }

  async delete(userId: string) {
    const existingUser = await this.userRepository.findUserById(userId)

    if (!existingUser) {
      throw new ClientError('User not found.', 404)
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
      throw new ClientError('User not found.', 404)
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
      throw new ClientError('User not found.', 404)
    }

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.', 404)
    }

    const userGameStatus = await this.userRepository.findUserGameStatus(
      gameId,
      userId
    )

    return {
      userGameStatus: userGameStatus?.UserGamesStatus || null
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
    filter: Status | undefined,
    query: string | undefined
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const rawUserGames = await this.userRepository.findManyGamesOfUser(userId, {
      pageIndex,
      query,
      limit: this.ITEMS_PER_PAGE,
      filter
    })

    const userGames: Record<string, Game[]> = {
      PLAYED: [],
      PLAYING: [],
      PAUSED: [],
      BACKLOG: [],
      WISHLIST: []
    }

    for (const entry of rawUserGames) {
      const status = entry.UserGamesStatus.status

      if (!entry.game) {
        continue
      }

      const gameObj = {
        ...entry.game,
        status
      } as Game

      userGames[status].push(gameObj)
    }

    const totalPerStatus = await this.userRepository.findGamesCountByStatus(
      userId
    )

    const formattedTotalPerStatus = totalPerStatus.map(item => ({
      status: item.status,
      totalGames: item._count.userGames
    }))

    return {
      userGames,
      totalPerStatus: formattedTotalPerStatus
    }
  }

  async removeGame(gameId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found.', 404)
    }

    const gameHasBeenAlreadyRemovedtoUserLibrary =
      await this.userRepository.findUserGame(gameId, userId)

    if (!gameHasBeenAlreadyRemovedtoUserLibrary) {
      throw new ClientError('This game is removed from your library', 409)
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

  async updateGame(gameId: string, userId: string, statusId: number) {
    if (!statusId) {
      throw new ClientError('You need to pass your status', 400)
    }

    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const existingGame = this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found.', 404)
    }

    const userGame = await this.userRepository.findUserGame(gameId, userId)

    if (!userGame?.game) {
      throw new ClientError('Game not found in your library.', 404)
    }

    // sempre que mudar de played para qualquer outro status, precisam perder contagem de played, e quando voltar para played adicionar

    const currentStatus = userGame.UserGamesStatus.id
    const PLAYED_STATUS = 1

    if (currentStatus === PLAYED_STATUS && statusId !== PLAYED_STATUS) {
      await this.userRepository.removeUserGameStats(userId, gameId)

      const { game, UserGamesStatus } =
        await this.userRepository.updateGameStatus(gameId, userId, statusId)

      return {
        game,
        userGameStatus: UserGamesStatus,
        playedCountUpdated: 0
      }
    }

    if (currentStatus !== PLAYED_STATUS && statusId === PLAYED_STATUS) {
      const playedCountUpdated = await this.userRepository.createUserGameStats(
        userId,
        userGame.game.id
      )

      const { game, UserGamesStatus } =
        await this.userRepository.updateGameStatus(gameId, userId, statusId)

      return {
        game,
        userGameStatus: UserGamesStatus,
        playedCountUpdated: playedCountUpdated?.completions
      }
    }

    const { game, UserGamesStatus } =
      await this.userRepository.updateGameStatus(gameId, userId, statusId)

    return {
      game,
      userGameStatus: UserGamesStatus,
      playedCountUpdated: 0
    }
  }

  async update(userId: string, data: UpdateUserDTO) {
    const userAlreadyExist = await this.userRepository.findUserById(userId)

    if (!userAlreadyExist) {
      throw new ClientError('User not found.', 404)
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
      throw new ClientError('User not found.', 404)
    }
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.', 404)
    }

    const { stats } = await this.userRepository.findUserGameStats(
      gameId,
      userId
    )

    return {
      playedCount: stats?.completions || { completions: 0 }
    }
  }

  async updateUserGamePlayedCount(
    userId: string,
    gameId: string,
    incrementValue: number
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const existingGame = await this.gameRepository.findById(gameId)

    if (!existingGame) {
      throw new ClientError('Game not found.', 404)
    }

    const userGameStats = await this.userRepository.updateUserGamePlayedCount(
      userId,
      existingGame.id,
      incrementValue
    )

    return { playedCount: userGameStats.completions }
  }

  async findGamesToDisplay(userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found.', 404)
    }

    const [userGames, games] = await Promise.all([
      this.userRepository.findManyGamesOfUser(userId),
      this.gameRepository.findGamesToDisplay()
    ])

    const gamesWithOutUserId = games.filter(g =>
      g.userGames.every(id => id.userId !== userId)
    )

    const playingGames = userGames.filter(
      ug => ug.UserGamesStatus.status === Status.PLAYING
    )
    const backlogGames = userGames.filter(
      ug => ug.UserGamesStatus.status === Status.BACKLOG
    )

    if (playingGames.length > 0) {
      const gameIndex = randomInt(playingGames.length)
      return {
        game: playingGames[gameIndex].game,
        message: 'Por que não terminar o que já começou?'
      }
    } else if (backlogGames.length > 0) {
      const gameIndex = randomInt(backlogGames.length)
      return {
        game: backlogGames[gameIndex].game,
        message: 'Tire a poeira desses jogos esquecidos.'
      }
    } else if (gamesWithOutUserId.length > 0) {
      const gameIndex = randomInt(gamesWithOutUserId.length)
      console.log('oi')
      return {
        game: gamesWithOutUserId[gameIndex],
        message: 'Que tal adicionar um novo jogo a sua biblioteca?'
      }
    } else {
      return { message: 'Parabéns! Você jogou todos.' }
    }
  }
}
