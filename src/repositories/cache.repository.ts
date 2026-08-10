import { redis } from "../database/redis";

export class CacheRepository {
  async get(key: string): Promise<unknown | null> {
    const cached = await redis.get(key)
    if (cached === null) {
      return null
    }

    return JSON.parse(cached)
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serializedValue = JSON.stringify(value)

    await redis.set(key, serializedValue, 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }
}
