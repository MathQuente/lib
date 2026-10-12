import { CacheRepository } from '../repositories/cache.repository'

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15

export const sessionsRevokedAtKey = (userId: string) =>
  `sessions-revoked-at:${userId}`

export async function markSessionsRevoked(
  cacheRepository: CacheRepository,
  userId: string
) {
  await cacheRepository.set(
    sessionsRevokedAtKey(userId),
    Math.floor(Date.now() / 1000),
    ACCESS_TOKEN_TTL_SECONDS
  )
}
