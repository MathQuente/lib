import { redis } from '../database/redis'

const INCREMENT_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`

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

  async setIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<boolean> {
    const result = await redis.set(
      key,
      JSON.stringify(value),
      'EX',
      ttlSeconds,
      'NX'
    )
    return result === 'OK'
  }

  async getdel(key: string): Promise<unknown | null> {
    const cached = await redis.getdel(key)
    if (cached === null) {
      return null
    }

    return JSON.parse(cached)
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await redis.eval(
      INCREMENT_WITH_TTL_SCRIPT,
      1,
      key,
      ttlSeconds
    )
    return Number(count)
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }
}
