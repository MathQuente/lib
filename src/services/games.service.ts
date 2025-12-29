import { CreateGameDTO, UpdateGameDTO } from '../dtos/game.dto'
import { ClientError } from '../errors/client-error'
import { GameRepository } from '../repositories/games.repository'
import { RatingRepository } from '../repositories/rating.repository'

export class GameService {
  private itemsPerPage = 36

  constructor(
    private gameRepository: GameRepository,
    private ratingRepository: RatingRepository
  ) {}

  async createGame(data: CreateGameDTO) {
    const isGameNameAlreadyUsed = await this.gameRepository.findByName(
      data.gameName
    )

    if (isGameNameAlreadyUsed) {
      throw new ClientError('This game name is already used.', 409)
    }

    const game = await this.gameRepository.create(data)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async deleteGame(gameId: string) {
    const gameHasBeenRemoved = await this.gameRepository.findById(gameId)

    if (!gameHasBeenRemoved) {
      throw new ClientError('This game has been already removed.', 404)
    }

    const game = await this.gameRepository.delete(gameId)

    return {
      game: {
        id: game.id,
        gameName: game.gameName
      }
    }
  }

  async findAllGames(
    pageIndex: number,
    query: string | undefined,
    sortBy: 'gameName' | 'dateRelease' | 'rating',
    sortOrder: 'asc' | 'desc' = 'asc',
    limit?: number
  ) {
    this.itemsPerPage = limit || this.itemsPerPage

    const [games, total] = await Promise.all([
      this.gameRepository.findManyGames(
        pageIndex,
        this.itemsPerPage,
        query,
        sortBy,
        sortOrder
      ),
      this.gameRepository.countGames(query)
    ])

    return {
      games: games.map(game => ({
        id: game?.id,
        gameName: game?.gameName,
        gameBanner: game?.gameBanner,
        gameLaunchers: game?.gameLaunchers.map(launcher => ({
          dateRelease: launcher.dateRelease,
          platformId: launcher.platformId,
          platforms: {
            id: launcher.platforms.id,
            platformName: launcher.platforms.platformName
          }
        })),
        platforms: game?.platforms.map(platform => ({
          id: platform.id,
          platformName: platform.platformName
        })),
        summary: game?.summary,
        isDlc: game?.isDlc
      })),
      total
    }
  }

  async findFeaturedGames() {
    const mostRatedGames = await this.gameRepository.findManyGamesByMostRating()
    const trendingGames = await this.gameRepository.findManyGamesByTrending()
    const recentGames = await this.gameRepository.findManyGamesByRecentDate()
    const futureGames = await this.gameRepository.findManyGamesByFutureRelease()

    const mostRatedGamesWithAvg = await Promise.all(
      mostRatedGames.map(async game => {
        const avgRatingOfGame =
          await this.ratingRepository.findAverageRatingOfGame(game!.id)
        return {
          ...game,
          ratingAvg: avgRatingOfGame._avg.value
        }
      })
    )

    return {
      mostRatedGames: mostRatedGamesWithAvg,
      trendingGames,
      recentGames,
      futureGames
    }
  }

  async findComingSoonGames(
    pageIndex: number,
    query: string | undefined,
    sortBy: 'gameName' | 'dateRelease' | 'rating',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const games = await this.gameRepository.findManyGamesByFutureRelease(
      pageIndex,
      this.itemsPerPage,
      query,
      sortBy,
      sortOrder
    )

    const total = await this.gameRepository.countComingSoonGames(query)

    return { games, total }
  }

  async findGameById(gameId: string) {
    const game = await this.gameRepository.findById(gameId)

    if (!game || !game.userGames) {
      throw new ClientError('Game not found.', 404)
    }

    const ratings = await this.ratingRepository.findRatingDistribution(gameId)

    const amountOfRatings = await this.ratingRepository.countRatingByName(
      gameId
    )

    const avgRatingOfGame = await this.ratingRepository.findAverageRatingOfGame(
      gameId
    )

    const statusCounts = {
      PLAYED: 0,
      PLAYING: 0,
      PAUSED: 0,
      BACKLOG: 0,
      WISHLIST: 0
    }

    for (const entry of game.userGames) {
      const status = entry.UserGamesStatus.status
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++
      }
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
        ratingAvg: avgRatingOfGame._avg.value,
        ratings: ratings.map(rating => ({
          rating: rating.value,
          count: rating._count.value
        })),
        amountOfRatings: amountOfRatings.value,
        userGames: statusCounts,
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
    const original = this.findGameById(gameId)

    if (!original) return []

    const categoryIds = (await original).game.categories.map(c => c.id)

    const studioIds = (await original).game.gameStudios.map(s => s.id)

    const samestudio = await this.gameRepository.findGamesFromSameStudio(
      gameId,
      studioIds
    )

    const remaining = await this.gameRepository.findCategoriesOfGameById(
      gameId,
      samestudio,
      categoryIds
    )

    return [...samestudio, ...remaining]
  }

  async updateGame(gameId: string, data: UpdateGameDTO) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('Game not found.', 404)
    }

    if (data.gameName && data.gameName !== gameAlreadyExist.gameName) {
      const isGameNameAlreadyUsed = await this.gameRepository.findByName(
        data.gameName
      )

      if (isGameNameAlreadyUsed) {
        throw new ClientError('Game name is already used', 409)
      }
    }

    const game = await this.gameRepository.update(gameId, data)

    return game
  }
}
