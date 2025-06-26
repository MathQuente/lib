import { CreateGameDTO, UpdateGameDTO } from '../dtos/game.dto'
import { ClientError } from '../errors/client-error'
import { GameRepository } from '../repositories/games.repository'
import { PlatformRepository } from '../repositories/platforms.repository'

export class GameService {
  private readonly itemsPerPage = 36

  constructor(
    private gameRepository: GameRepository,
    private platformRepository: PlatformRepository
  ) {}

  async createGame(data: CreateGameDTO) {
    const gameNameIsAlreadyUsed = await this.gameRepository.findByName(
      data.gameName
    )

    if (gameNameIsAlreadyUsed) {
      throw new ClientError('This game name is already used to another game')
    }

    const game = await this.gameRepository.create(data)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async createGameDateRelease(
    gameId: string,
    dateRelease: Date,
    platformId: string
  ) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('Game not found.')
    }

    const platformAlreadyExist = await this.platformRepository.findById(
      platformId
    )

    if (!platformAlreadyExist) {
      throw new ClientError('Platform not found.')
    }

    const gameDateIsAlreadyUsed = await this.gameRepository.findDateRelease(
      gameId,
      platformId
    )

    if (gameDateIsAlreadyUsed) {
      throw new ClientError('The game is already released in this date.')
    }

    const gameDateRelease = await this.gameRepository.createGameDateRelease(
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

    const game = await this.gameRepository.delete(gameId)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async findAllGameStatus() {
    const status = await this.gameRepository.findManyGameStatus()

    return {
      status: status.map(currentStatus => ({
        id: currentStatus.id,
        status: currentStatus.status
      }))
    }
  }

  async findAllGames(
    pageIndex: number,
    search: string | null,
    sortBy: 'gameName' | 'dateRelease' | 'rating',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const [games, total] = await Promise.all([
      this.gameRepository.findManyGames(
        pageIndex,
        this.itemsPerPage,
        search,
        sortBy,
        sortOrder
      ),
      this.gameRepository.countGames(search)
    ])

    return {
      games: games.map(game => ({
        id: game?.id,
        gameName: game?.gameName,
        gameBanner: game?.gameBanner,
        gameStudios: game?.gameStudios.map(studio => ({
          id: studio.id,
          studioName: studio.studioName
        })),
        categories: game?.categories.map(category => ({
          id: category.id,
          categoryName: category.categoryName
        })),
        publishers: game?.publishers.map(publisher => ({
          id: publisher.id,
          publisherName: publisher.publisherName
        })),
        platforms: game?.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        summary: game?.summary,
        gameLaunchers: game?.gameLaunchers.map(launcher => ({
          // dateRelease: launcher.dateRelease,
          platform: {
            id: launcher.platforms.id,
            platformName: launcher.platforms.platformName
          }
        })),
        isDlc: game?.isDlc,
        dlcs: game?.dlcs.map(dlc => ({
          id: dlc.id,
          gameBanner: dlc.gameBanner,
          gameName: dlc.gameName
        })),
        parentGame: game?.parentGame
      })),
      total
    }
  }

  async findMostBeated() {
    const mostBeateds = await this.gameRepository.findManyGamesByMostBeated()
    const gamesTrending = await this.gameRepository.findManyGamesByTrending()
    const recentGames = await this.gameRepository.findManyGamesByRecentDate()
    const futureGames = await this.gameRepository.findManyGamesByFutureRelease()

    return { mostBeateds, gamesTrending, recentGames, futureGames }
  }

  async findGameById(gameId: string) {
    const game = await this.gameRepository.findById(gameId)

    if (!game) {
      throw new ClientError('Game not found.')
    }

    return {
      game: {
        id: game.id,
        gameName: game.gameName,
        gameBanner: game.gameBanner,
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
          platform: {
            id: launcher.platforms.id,
            platformName: launcher.platforms.platformName
          }
        })),
        isDlc: game.isDlc,
        dlcs: game.dlcs.map(dlc => ({
          id: dlc.id,
          gameBanner: dlc.gameBanner,
          gameName: dlc.gameName
        })),
        parentGame: game.parentGame
          ? {
              id: game.parentGame.id,
              gameName: game.parentGame.gameName,
              gameBanner: game.parentGame.gameBanner
            }
          : null
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
      throw new ClientError('Game not found.')
    }

    const game = await this.gameRepository.update(gameId, {
      categories: data.categories,
      gameBanner: data.gameBanner,
      gameName: data.gameName,
      gameStudios: data.gameStudios,
      platforms: data.platforms,
      publishers: data.publishers,
      summary: data.summary,
      isDlc: data.isDlc,
      parentGameId: data.parentGameId
    })

    return { game }
  }
}
