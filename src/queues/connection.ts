import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL
if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required')
}

export const bullConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null
})
