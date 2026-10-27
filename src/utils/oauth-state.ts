import { CacheRepository } from '../repositories/cache.repository'

export const OAUTH_STATE_TTL_SECONDS = 600
export const oauthStateKey = (state: string) => `oauth-state:${state}`

export function parseAcceptedTerms(value: unknown): boolean {
  return value === 'true'
}

export async function saveOAuthState(
  cache: Pick<CacheRepository, 'set'>,
  state: string,
  acceptedTerms: boolean
) {
  await cache.set(
    oauthStateKey(state),
    { acceptedTerms },
    OAUTH_STATE_TTL_SECONDS
  )
}

export async function readOAuthState(
  cache: Pick<CacheRepository, 'get'>,
  state: string
): Promise<{ acceptedTerms: boolean } | null> {
  const stored = await cache.get(oauthStateKey(state))
  if (stored === null || stored === undefined || stored === false) return null

  const acceptedTerms =
    typeof stored === 'object' &&
    (stored as { acceptedTerms?: unknown }).acceptedTerms === true
  return { acceptedTerms }
}
