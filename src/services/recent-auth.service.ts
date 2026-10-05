import { CacheRepository } from '../repositories/cache.repository'

const RECENT_AUTH_TTL_SECONDS = 10 * 60
const recentAuthKey = (userId: string) => `recent-auth:${userId}`

export class RecentAuthService {
  constructor(
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  async mark(userId: string) {
    await this.cacheRepository.set(
      recentAuthKey(userId),
      true,
      RECENT_AUTH_TTL_SECONDS
    )
  }

  async isRecent(userId: string): Promise<boolean> {
    return (await this.cacheRepository.get(recentAuthKey(userId))) !== null
  }
}
