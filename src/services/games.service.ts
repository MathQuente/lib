import { ClientError } from '../errors/client-error'
import { IGDBGame } from '../types/igdb'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { IGDBService } from './igdb.service'
import { CacheRepository } from '../repositories/cache.repository'

const TRENDING_WINDOW_DAYS = 30
const GAME_CACHE_TTL_SECONDS = 60 * 60

export class GameService {
  constructor(
    private ratingRepository: RatingRepository,
    private gameCacheRepository: GameCacheRepository,
    private userRepository: UserRepository,
    private cacheRepository: CacheRepository
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
      publishers: publishers && publishers.length > 0 ? publishers : undefined,
      category: game.category ?? -1,
      parentGameId: game.parent_game ?? null
    }
  }

  private async enrichWithSiteRatings(games: IGDBGame[]) {
    const igdbIds = games.map(g => g.id)
    const ratingsMap =
      await this.ratingRepository.getAverageRatingsForGames(igdbIds)
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
    const ratingsMap =
      await this.ratingRepository.getAverageRatingsForGames(igdbIds)

    const games = cached.map(g => ({
      igdbId: g.igdbId,
      name: g.name,
      coverUrl: g.coverUrl ?? null,
      summary: g.summary ?? undefined,
      genres: g.genres.length > 0 ? g.genres : undefined,
      platforms: g.platforms.length > 0 ? g.platforms : undefined,
      releaseDate: g.releaseDate ?? undefined,
      siteRating: ratingsMap.get(g.igdbId) ?? null,
      category: g.category ?? -1,
      parentGameId: g.parentGameId ?? null
    }))

    return { games, total }
  }

  async findGameById(igdbId: number) {
    const key = `game:${igdbId}`

    const cached = await this.cacheRepository.get(key)

    let game: IGDBGame | null
    let relatedGames: IGDBGame[]

    if (cached !== null) {
      const parsed = cached as { game: IGDBGame; relatedGames: IGDBGame[] }
      game = parsed.game
      relatedGames = parsed.relatedGames
    } else {
      game = await IGDBService.getGameById(igdbId)

      if (!game) {
        throw new ClientError('Game not found.', 404)
      }

      relatedGames = await IGDBService.getRelatedGames(igdbId)

      await this.cacheRepository.set(
        key,
        { game, relatedGames },
        GAME_CACHE_TTL_SECONDS
      )
    }

    const ratingsMap = await this.ratingRepository.getAverageRatingsForGames([
      igdbId,
      ...relatedGames.map(g => g.id)
    ])

    return {
      game: this.formatGame(game, ratingsMap.get(igdbId) ?? null),
      relatedGames: relatedGames.map(g =>
        this.formatGame(g, ratingsMap.get(g.id) ?? null)
      )
    }
  }

  async findFeaturedGames() {
    const [trending, mostRated, recent, future] = await Promise.all([
      this.findTrendingGames(6),
      this.findMostRatedGames(6),
      this.findRecentlyReleasedGames(6),
      this.findComingSoonGames(6)
    ])

    return {
      mostRatedGames: mostRated.games,
      trendingGames: trending.games,
      recentGames: recent.games,
      futureGames: future.games
    }
  }

  private async findRecentlyReleasedGames(limit = 6) {
    const key = `games:recent:${limit}`
    let games: IGDBGame[]
    const cached = await this.cacheRepository.get(key)

    if (cached !== null) {
      games = (cached as { games: IGDBGame[] }).games
    } else {
      games = await IGDBService.getRecentlyReleasedGames(limit)
      await this.cacheRepository.set(key, { games }, GAME_CACHE_TTL_SECONDS)
    }

    return { games: await this.enrichWithSiteRatings(games) }
  }

  async findComingSoonGames(limit = 20, pageIndex = 0) {
    const key = `games:comingSoon:${limit}:${pageIndex}`
    let games: IGDBGame[]
    let total: number
    const cached = await this.cacheRepository.get(key)

    if (cached !== null) {
      const parsed = cached as { games: IGDBGame[]; total: number }
      games = parsed.games
      total = parsed.total
    } else {
      const results = await IGDBService.getComingSoonGames(limit, pageIndex)

      games = results.games
      total = results.total

      await this.cacheRepository.set(
        key,
        { games, total },
        GAME_CACHE_TTL_SECONDS
      )
    }

    return { games: await this.enrichWithSiteRatings(games), total }
  }

  private async findReleasedGamesByRankedIds(
    rankedIds: number[],
    siteRatings: Map<number, number | null>
  ) {
    const cutoff = IGDBService.getReleaseCutoffEpoch()
    const keys = rankedIds.map(id => `game:meta:${id}`)
    const cachedResults = await Promise.all(
      keys.map(key => this.cacheRepository.get(key))
    )

    const cachedGames: IGDBGame[] = []
    const missingIds: number[] = []

    rankedIds.forEach((id, i) => {
      const cached = cachedResults[i]
      if (cached !== null) {
        cachedGames.push(cached as IGDBGame)
      } else {
        missingIds.push(id)
      }
    })

    const fetched = await IGDBService.getGamesByIds(missingIds)

    await Promise.all(
      fetched.map(g =>
        this.cacheRepository.set(`game:meta:${g.id}`, g, GAME_CACHE_TTL_SECONDS)
      )
    )

    const games = [...cachedGames, ...fetched]
    const gamesById = new Map(games.map(g => [g.id, g]))

    const ordered = rankedIds
      .map(id => gamesById.get(id))
      .filter(
        (g): g is IGDBGame =>
          !!g && g.first_release_date != null && g.first_release_date < cutoff
      )

    return ordered.map(g => this.formatGame(g, siteRatings.get(g.id) ?? null))
  }

  private async findTrendingGames(limit = 20) {
    const since = new Date(
      Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
    const trending = await this.userRepository.findTrendingIgdbIds(limit, since)
    if (trending.length === 0) return { games: [], total: 0 }

    const igdbIds = trending.map(t => t.igdbId)
    const ratingsMap =
      await this.ratingRepository.getAverageRatingsForGames(igdbIds)
    const games = await this.findReleasedGamesByRankedIds(igdbIds, ratingsMap)

    return { games, total: games.length }
  }

  private async findMostRatedGames(limit = 20) {
    const topRated = await this.ratingRepository.findTopRatedIgdbIds(limit)
    if (topRated.length === 0) return { games: [], total: 0 }

    const igdbIds = topRated.map(r => r.igdbId)
    const ratingsMap = new Map<number, number | null>(
      topRated.map(r => [r.igdbId, r.avgRating])
    )
    const games = await this.findReleasedGamesByRankedIds(igdbIds, ratingsMap)

    return { games, total: games.length }
  }

  async findSimilarGames(igdbId: number) {
    const key = `game:similar:${igdbId}`

    const cached = await this.cacheRepository.get(key)

    let games: IGDBGame[]

    if (cached !== null) {
      const parsed = cached as { games: IGDBGame[] }

      games = parsed.games
    } else {
      games = await IGDBService.getSimilarGames(igdbId)

      await this.cacheRepository.set(key, { games }, GAME_CACHE_TTL_SECONDS)
    }

    return this.enrichWithSiteRatings(games)
  }
}
