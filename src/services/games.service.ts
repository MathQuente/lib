import { ClientError } from '../errors/client-error'
import { IGDBGame } from '../types/igdb'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { IGDBService } from './igdb.service'

export class GameService {
  constructor(
    private ratingRepository: RatingRepository,
    private gameCacheRepository: GameCacheRepository
  ) {}

  private formatGame(game: IGDBGame, siteRating: number | null = null) {
    const developers = game.involved_companies
      ?.filter(c => c.developer)
      .map(c => c.company.name)
    const publishers = game.involved_companies
      ?.filter(c => c.publisher)
      .map(c => c.company.name)

    return {
      igdbId: game.id,
      name: game.name,
      coverUrl: IGDBService.formatCoverUrl(game.cover?.url),
      summary: game.summary,
      genres: game.genres?.map(g => g.name),
      platforms: game.platforms?.map(p => p.name),
      releaseDate: game.first_release_date,
      siteRating,
      developers: developers && developers.length > 0 ? developers : undefined,
      publishers: publishers && publishers.length > 0 ? publishers : undefined
    }
  }

  private async enrichWithSiteRatings(games: IGDBGame[]) {
    const igdbIds = games.map(g => g.id)
    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames(igdbIds)
    return games.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null))
  }

  async findAllGames(
    query: string | undefined,
    limit: number,
    pageIndex: number,
    sortBy: 'name' | 'release_date' | 'rating',
    sortOrder: 'asc' | 'desc'
  ) {
    const { games: cached, total } = await this.gameCacheRepository.findMany({
      limit,
      pageIndex,
      sortBy,
      sortOrder,
      query
    })

    const igdbIds = cached.map(g => g.igdbId)
    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames(igdbIds)

    const games = cached.map(g => ({
      igdbId: g.igdbId,
      name: g.name,
      coverUrl: g.coverUrl ?? null,
      summary: g.summary ?? undefined,
      genres: g.genres.length > 0 ? g.genres : undefined,
      platforms: g.platforms.length > 0 ? g.platforms : undefined,
      releaseDate: g.releaseDate ?? undefined,
      siteRating: ratingsMap.get(g.igdbId) ?? null
    }))

    return { games, total }
  }

  async findGameById(igdbId: number) {
    const game = await IGDBService.getGameById(igdbId)

    if (!game) {
      throw new ClientError('Game not found.', 404)
    }

    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames([igdbId])
    return { game: this.formatGame(game, ratingsMap.get(igdbId) ?? null) }
  }

  async findFeaturedGames() {
    const { mostRated, trending, recent, future } =
      await IGDBService.getFeaturedGames()

    const allGames = [...mostRated, ...trending, ...recent, ...future]
    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames(
      allGames.map(g => g.id)
    )

    return {
      mostRatedGames: mostRated.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null)),
      trendingGames: trending.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null)),
      recentGames: recent.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null)),
      futureGames: future.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null))
    }
  }

  async findComingSoonGames(limit = 20) {
    const games = await IGDBService.getComingSoonGames(limit)
    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames(
      games.map(g => g.id)
    )
    const formatted = games.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null))
    return { games: formatted, total: formatted.length }
  }

  async findSimilarGames(igdbId: number) {
    const games = await IGDBService.getSimilarGames(igdbId)
    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames(
      games.map(g => g.id)
    )
    return games.map(g => this.formatGame(g, ratingsMap.get(g.id) ?? null))
  }
}
