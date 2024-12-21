import { CreateGameDTO, UpdateGameDTO } from '../dtos/games.dto'
import { ClientError } from '../errors/client-error'
import { GameRepository } from '../repositories/games.repository'
import { DlcRepository } from '../repositories/dlcs.repository'

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

  async findAllGamesAndDlcs(
    pageIndex: number,
    search: string | null | undefined
  ) {
    const games = await this.gameRepository.findManyGames(search)

    const resultFiltered = games.flatMap(game => [
      {
        id: game.id,
        name: game.gameName,
        banner: game.gameBanner,
        gameStudios: game.gameStudios,
        categories: game.categories,
        publishers: game.publishers,
        platforms: game.platforms,
        summary: game.summary,
        gameLaunchers: game.gameLaunchers,
        dlcs: game.dlcs,
        type: 'game'
      },
      ...game.dlcs.map(dlc => ({
        id: dlc.id,
        name: dlc.dlcName,
        banner: dlc.dlcBanner,
        categories: dlc.categories,
        game: dlc.game,
        gameStudios: dlc.gameStudios,
        gameLaunchers: dlc.gameLaunchers,
        publishers: dlc.publishers,
        platforms: dlc.platforms,
        summary: dlc.summary,
        type: 'dlc'
      }))
    ])

    const startIndex = pageIndex * this.ITEMS_PER_PAGE
    const paginatedResutls = resultFiltered.slice(
      startIndex,
      startIndex + this.ITEMS_PER_PAGE
    )

    return {
      games: paginatedResutls,
      total: resultFiltered.length
    }
  }

  async findGameById(gameId: string) {
    const game = await this.gameRepository.findById(gameId)

    const dlc = await this.dlcRepository.findDlcById(gameId)

    if (!game && !dlc) {
      throw new ClientError('Item with this id has not founded.')
    }

    if (game) {
      return {
        id: game.id,
        name: game.gameName,
        banner: game.gameBanner,
        gameStudios: game.gameStudios.map(studio => ({
          id: studio.id,
          studioName: studio.studioName
        })),
        categories: game.categories.map(category => ({
          id: category.id,
          categoryName: category.categoryName
        })),
        publishers: game.publishers.map(publisher => ({
          id: publisher.id,
          publisherName: publisher.publisherName
        })),
        platforms: game.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        summary: game.summary,
        gameLaunchers: game.gameLaunchers.map(launcher => ({
          dateRelease: launcher.dateRelease,
          platforms: launcher.platforms
        })),
        dlcs: game.dlcs.map(dlc => ({
          id: dlc.id,
          banner: dlc.dlcBanner,
          name: dlc.dlcName
        })),
        type: 'game'
      }
    }

    return {
      id: dlc?.id,
      name: dlc?.dlcName,
      banner: dlc?.dlcBanner,
      game: {
        id: dlc?.game.id,
        banner: dlc?.game.gameBanner,
        name: dlc?.game.gameName
      },
      gameStudios: dlc?.gameStudios.map(studio => ({
        id: studio.id,
        studioName: studio.studioName
      })),
      categories: dlc?.categories.map(category => ({
        id: category.id,
        categoryName: category.categoryName
      })),
      publishers: dlc?.publishers.map(publisher => ({
        id: publisher.id,
        publisherName: publisher.publisherName
      })),
      platforms: dlc?.platforms.map(platform => ({
        id: platform.id,
        platformName: platform.platformName
      })),
      summary: dlc?.summary,
      gameLaunchers: dlc?.gameLaunchers.map(launcher => ({
        dateRelease: launcher.dateRelease,
        platforms: launcher.platforms
      })),
      dlcs: [], // DLC não tem DLCs
      type: 'dlc'
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
