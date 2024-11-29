import { CreateGameDTO, UpdateGameDTO } from '../dtos/games.dto'
import { ClientError } from '../errors/client-error'
import { DlcRepository } from '../repositories/dlcs.repository'
import { GameRepository } from '../repositories/games.repository'

export class GameService {
  private readonly ITEMS_PER_PAGE = 18

  constructor(
    private gameRepository: GameRepository,
    private dlcRepository: DlcRepository
  ) {}

  async createGame(data: CreateGameDTO) {
    const gameNameIsAlreadyUsed = await this.gameRepository.findByName(
      data.gameName
    )

    if (gameNameIsAlreadyUsed) {
      throw new ClientError('This game name is already used to another game')
    }

    const game = await this.gameRepository.createGame(data)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async addPlatformRelease(
    gameId: string,
    dateRelease: Date,
    platformId: string
  ) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('This game has not found.')
    }

    const gameDateIsAlreadyUsed = await this.gameRepository.findDateRelease(
      gameId,
      platformId
    )

    if (gameDateIsAlreadyUsed) {
      throw new ClientError('The game is already released in this date.')
    }

    const gameDateRelease = await this.gameRepository.createGameRelease(
      gameId,
      dateRelease,
      platformId
    )

    return {
      gameDateRelease: {
        dateRelease: gameDateRelease.dateRelease,
        platformId: gameDateRelease.platforms.id,
        platformName: gameDateRelease.platforms.platformName
      }
    }
  }

  async deleteGame(gameId: string) {
    const gameHasBeenRemoved = await this.gameRepository.findById(gameId)

    if (!gameHasBeenRemoved) {
      throw new ClientError('This game has been already removed')
    }

    const game = await this.gameRepository.deleteGame(gameId)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async findAllGameStatus() {
    const status = await this.gameRepository.findManyGameStatus()

    return status.map(currentStatus => ({
      id: currentStatus.id,
      status: currentStatus.status
    }))
  }

  async findAllGamesAndDlcs(pageIndex: number) {
    const games = await this.gameRepository.findManyGames({
      pageIndex,
      limit: this.ITEMS_PER_PAGE
    })

    const dlcs = await this.dlcRepository.findManyDlcs({
      pageIndex,
      limit: this.ITEMS_PER_PAGE
    })

    return {
      games: games.map(game => ({
        id: game.id,
        categories: game.categories.map(category => ({
          id: category.id,
          categoryName: category.categoryName
        })),
        dlcs: game.dlcs.map(dlc => ({
          id: dlc.id,
          dlcBanner: dlc.dlcBanner,
          dlcName: dlc.dlcName
        })),
        gameBanner: game.gameBanner,
        gameName: game.gameName,
        gameStudios: game.gameStudios.map(gameStudio => ({
          studioName: gameStudio.studioName
        })),
        gameLaunchers: game.gameLaunchers.map(gameLauncher => ({
          gameLauncher: {
            dateRelease: gameLauncher.dateRelease,
            id: gameLauncher.platforms.id,
            platform: gameLauncher.platforms.platformName
          }
        })),
        platforms: game.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        publishers: game.publishers.map(publisher => ({
          id: publisher.id,
          publisherName: publisher.publisherName
        }))
      })),
      dlcs: dlcs.map(dlc => ({
        id: dlc.id,
        categories: dlc.categories.map(category => ({
          id: category.id,
          categoryName: category.categoryName
        })),
        dlcBanner: dlc.dlcBanner,
        dlcName: dlc.dlcName,
        game: dlc.game,
        gameStudios: dlc.gameStudios.map(gameStudio => ({
          studioName: gameStudio.studioName
        })),
        gameLaunchers: dlc.gameLaunchers.map(gameLauncher => ({
          gameLauncher: {
            dateRelease: gameLauncher.dateRelease,
            id: gameLauncher.platforms.id,
            platform: gameLauncher.platforms.platformName
          }
        })),
        platforms: dlc.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        publishers: dlc.publishers.map(publisher => ({
          id: publisher.id,
          publisherName: publisher.publisherName
        }))
      }))
    }
  }

  async findGameById(gameId: string) {
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game with this id has not founded.')
    }

    return {
      game: {
        id: game.id,
        categories: game.categories.map(category => ({
          id: category.id,
          categoryName: category.categoryName
        })),
        dlcs: game.dlcs.map(dlc => ({
          id: dlc.id,
          dlcBanner: dlc.dlcBanner,
          dlcName: dlc.dlcName
        })),
        gameBanner: game.gameBanner,
        gameName: game.gameName,
        gameStudios: game.gameStudios.map(gameStudio => ({
          studioName: gameStudio.studioName
        })),
        gameLaunchers: game.gameLaunchers.map(gameLauncher => ({
          dateRelease: gameLauncher.dateRelease,
          platformId: gameLauncher.platformId,
          platform: gameLauncher.platforms
        })),
        platforms: game.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        publishers: game.publishers.map(publisher => ({
          id: publisher.id,
          publisherName: publisher.publisherName
        }))
      }
    }
  }

  async findSimilarGames(gameId: string) {
    const gameCategories = await this.gameRepository.findCategoriesOfGameById(
      gameId
    )

    const gamesCategories = gameCategories?.categories || []

    const similarGames = await this.gameRepository.findSimilarGames(
      gamesCategories,
      gameId
    )

    return {
      similarGames
    }
  }

  async updateGame(gameId: string, data: UpdateGameDTO) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('This game has not found.')
    }

    const game = await this.gameRepository.updateGame(gameId, {
      categories: data.categories,
      gameBanner: data.gameBanner,
      gameName: data.gameName,
      gameStudios: data.gameStudios,
      platforms: data.platforms,
      publishers: data.publishers,
      summary: data.summary
    })

    return { game }
  }
}
