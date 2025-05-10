import { UpdateUserDTO } from '../dtos/users.dto'
import { ClientError } from '../errors/client-error'
import { DlcRepository } from '../repositories/dlcs.repository'
import { GameRepository } from '../repositories/games.repository'
import { UserRepository } from '../repositories/users.repository'

export class UserService {
  private readonly ITEMS_PER_PAGE = 18

  constructor(
    private userRepository: UserRepository,
    private gameRepository: GameRepository,
    private dlcRepository: DlcRepository
  ) {}

  async addGameOrDlc(itemId: string, userId: string, statusIds: number[]) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const [game, dlc] = await Promise.all([
      this.gameRepository.findById(itemId),
      this.dlcRepository.findDlcById(itemId)
    ])

    if (!game && !dlc) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    const type = game ? 'game' : 'dlc'

    if (game) {
      const gameHasBeenAlreadyAddtoUserLibrary =
        await this.userRepository.findUserItem(itemId, userId, 'game')

      if (gameHasBeenAlreadyAddtoUserLibrary) {
        throw new ClientError('This game is already in your library')
      }

      const selectedStatuses = await this.userRepository.findManyByIds(
        statusIds
      )

      const isPlayed = selectedStatuses.some(
        status => status.status === 'PLAYED'
      )

      const game = await this.userRepository.addItem({
        itemId,
        statusIds,
        type,
        userId
      })

      await this.userRepository.createUserGameStats(
        userId,
        itemId,
        isPlayed ? 1 : 0
      )

      return game
    }

    if (dlc) {
      const dlcHasBeenAlreadyAddtoUserLibrary =
        await this.userRepository.findUserItem(itemId, userId, 'dlc')

      if (dlcHasBeenAlreadyAddtoUserLibrary) {
        throw new ClientError('This dlc is already in your library')
      }

      const dlc = await this.userRepository.addItem({
        itemId,
        statusIds,
        type,
        userId
      })

      return dlc
    }
  }

  async deleteUser(userId: string) {
    const userAlreadyDeleted = await this.userRepository.findUserById(userId)

    if (!userAlreadyDeleted) {
      throw new ClientError('This user has been deleted.')
    }

    const user = await this.userRepository.deleteUser(userId)

    return {
      user
    }
  }

  async findUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const gamesAmount = await this.userRepository.countUserGames(userId)

    return {
      user: {
        profilePicture: user.profilePicture,
        userBanner: user.userBanner,
        userName: user.userName,
        gamesAmount: gamesAmount?._count.userGames
      }
    }
  }

  async findUserGameStatus(itemId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const [game, dlc] = await Promise.all([
      this.gameRepository.findById(itemId),
      this.dlcRepository.findDlcById(itemId)
    ])

    if (!game && !dlc) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    const type = game ? 'game' : 'dlc'

    return await this.userRepository.findUserItemStatus(itemId, userId, type)
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
        profilePicture: user.profilePicture
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

    const games = await this.userRepository.findManyGamesOfUser(
      userId,
      filter,
      {
        pageIndex,
        query,
        limit: this.ITEMS_PER_PAGE
      }
    )

    const totalPerStatus = await this.userRepository.findGamesCountByStatus(
      userId
    )

    const formattedTotalPerStatus = totalPerStatus.map(item => ({
      status: item.status, // Extraindo o statusId
      totalGames: item._count.userGames // Contando os jogos por status
    }))

    const resultFiltered = games
      .map(userGame => {
        const newItem: any = {}

        // Adiciona o jogo se existir e não estiver vazio
        if (userGame.game && Object.keys(userGame.game).length > 0) {
          newItem.id = userGame.game.id
          newItem.name = userGame.game.gameName
          newItem.banner = userGame.game.gameBanner
          newItem.gameStudios = userGame.game.gameStudios
          newItem.categories = userGame.game.categories
          newItem.publishers = userGame.game.publishers
          newItem.platforms = userGame.game.platforms
          newItem.summary = userGame.game.summary
          newItem.gameLaunchers = userGame.game.gameLaunchers
          newItem.dlcs = userGame.game.dlcs
          newItem.UserGamesStatus = userGame.statuses
          newItem.type = 'game'
        }

        // Adiciona a DLC se existir e não estiver vazia
        if (userGame.dlc && Object.keys(userGame.dlc).length > 0) {
          newItem.id = userGame.dlc.id
          newItem.name = userGame.dlc.dlcName
          newItem.banner = userGame.dlc.dlcBanner
          newItem.categories = userGame.dlc.categories
          newItem.game = {
            id: userGame.dlc.game.id,
            gameBanner: userGame.dlc.game.gameBanner,
            gameName: userGame.dlc.game.gameName
          }
          newItem.gameStudios = userGame.dlc.gameStudios
          newItem.gameLaunchers = userGame.dlc.gameLaunchers
          newItem.publishers = userGame.dlc.publishers
          newItem.platforms = userGame.dlc.platforms
          newItem.summary = userGame.dlc.summary
          newItem.UserGamesStatus = userGame.statuses
          newItem.type = 'dlc'
        }

        return newItem
      })
      .filter(item => Object.keys(item).length > 0)

    return {
      userGames: resultFiltered,
      totalPerStatus: formattedTotalPerStatus,
      totalGames: resultFiltered.length
    }
  }

  async removeGameOrDlc(itemId: string, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const [game, dlc] = await Promise.all([
      this.gameRepository.findById(itemId),
      this.dlcRepository.findDlcById(itemId)
    ])

    if (!game && !dlc) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    const type = game ? 'game' : 'dlc'

    if (game) {
      const gameHasBeenAlreadyRemovedtoUserLibrary =
        await this.userRepository.findUserItem(itemId, userId, 'game')

      if (!gameHasBeenAlreadyRemovedtoUserLibrary) {
        throw new ClientError('This game is removed from your library')
      }

      const game = await this.userRepository.removeItem(itemId, userId, type)

      return game
    }

    if (dlc) {
      const dlcHasBeenAlreadyRemovedtoUserLibrary =
        await this.userRepository.findUserItem(itemId, userId, 'dlc')

      if (!dlcHasBeenAlreadyRemovedtoUserLibrary) {
        throw new ClientError('This dlc is already removed from your library')
      }

      const dlc = await this.userRepository.removeItem(itemId, userId, type)

      return dlc
    }
  }

  async updateGameOrDlc(itemId: string, userId: string, statusIds: number[]) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }

    const [game, dlc] = await Promise.all([
      this.gameRepository.findById(itemId),
      this.dlcRepository.findDlcById(itemId)
    ])

    const type = game ? 'game' : 'dlc'

    if (!game && !dlc) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    if (game) {
      const gameIsInUserLibrary = await this.userRepository.findUserItem(
        itemId,
        userId,
        'game'
      )

      if (!gameIsInUserLibrary) {
        throw new ClientError(
          'This game is not in your library, you cant update.'
        )
      }

      const game = await this.userRepository.updateItemStatus(
        itemId,
        userId,
        statusIds,
        type
      )

      return game
    }

    if (dlc) {
      const dlcIsInUserLibrary = await this.userRepository.findUserItem(
        itemId,
        userId,
        'dlc'
      )

      if (!dlcIsInUserLibrary) {
        throw new ClientError(
          'This dlc is not in your library, you cant update.'
        )
      }

      const dlc = await this.userRepository.updateItemStatus(
        itemId,
        userId,
        statusIds,
        type
      )

      return dlc
    }
  }

  async updateUser(userId: string, data: UpdateUserDTO) {
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

  async findUserGameStats(userId: string, itemId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) {
      throw new ClientError('User not found')
    }
    const [game, dlc] = await Promise.all([
      this.gameRepository.findById(itemId),
      this.dlcRepository.findDlcById(itemId)
    ])

    if (!game && !dlc) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    const gameStats = await this.userRepository.findUserGameStats(
      userId,
      itemId
    )

    return gameStats
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

    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError(
        'Item not found - neither game nor DLC exists with this ID'
      )
    }

    const gameIsReplaying = await this.findUserGameStatus(gameId, userId)

    if (gameIsReplaying) {
      const gameFounded = gameIsReplaying.statuses.find(
        gameStatus => gameStatus.status == 'REPLAYING'
      )

      if (gameFounded) {
        const result = await this.userRepository.updateItemStatus(
          game.id,
          userId,
          [1],
          'game'
        )
      }
    }

    const updatedGame = await this.userRepository.updateUserGamePlayedCount(
      userId,
      game.id,
      incrementValue
    )

    return updatedGame
  }
}
