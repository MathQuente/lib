import { GameCacheRepository } from '../repositories/game-cache.repository'
import { IGDBService } from './igdb.service'
import { IGDBGame } from '../types/igdb'

export class GameCacheService {
  constructor(private gameCacheRepository: GameCacheRepository) {}

  // Returns whether igdbId is a real IGDB game (and, as a side effect,
  // makes sure it's cached). Used both to warm the cache (fire-and-forget,
  // return value ignored) and to validate a new library entry (awaited).
  async ensureCached(igdbId: number): Promise<boolean> {
    const cached = await this.gameCacheRepository.findByIgdbId(igdbId)
    if (cached) return true

    const game = await IGDBService.getGameById(igdbId)
    if (!game) return false

    await this.gameCacheRepository.upsertMany([
      IGDBService.toGameCacheInput(game)
    ])
    return true
  }

  async cacheMany(games: IGDBGame[]): Promise<void> {
    if (games.length === 0) return
    await this.gameCacheRepository.upsertMany(
      games.map(g => IGDBService.toGameCacheInput(g))
    )
  }
}
