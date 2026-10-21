import { ClientError } from '../errors/client-error'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { IGDBService } from './igdb.service'
import { IGDBGame } from '../types/igdb'

export class GameCacheService {
  constructor(private gameCacheRepository: GameCacheRepository) {}

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

  async assertReleased(igdbId: number): Promise<{ suggestsEndless: boolean }> {
    const cached = await this.gameCacheRepository.findReleaseInfoByIgdbId(igdbId)
    if (cached?.releaseDate != null && cached.releaseDate * 1000 > Date.now()) {
      throw new ClientError('Este jogo ainda não foi lançado.', 400)
    }
    return {
      suggestsEndless: cached ? IGDBService.suggestsEndless(cached) : false
    }
  }

  async suggestsEndless(igdbId: number): Promise<boolean> {
    const cached = await this.gameCacheRepository.findEndlessInputByIgdbId(
      igdbId
    )
    return cached ? IGDBService.suggestsEndless(cached) : false
  }

  async cacheMany(games: IGDBGame[]): Promise<void> {
    if (games.length === 0) return
    await this.gameCacheRepository.upsertMany(
      games.map(g => IGDBService.toGameCacheInput(g))
    )
  }
}
