import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens
} from 'psn-api'
import { PsnAuthService } from './psn-auth.service'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'

vi.mock('psn-api', () => ({
  exchangeNpssoForAccessCode: vi.fn(),
  exchangeAccessCodeForAuthTokens: vi.fn(),
  exchangeRefreshTokenForAuthTokens: vi.fn()
}))

function fakeCache(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial))
  const cache = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key)
    })
  }
  return { cache: cache as unknown as CacheRepository, store, spies: cache }
}

function tokens(suffix: string) {
  return {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    expiresIn: 3599,
    refreshTokenExpiresIn: 863999,
    idToken: 'id',
    scope: 'psn:mobile.v2.core',
    tokenType: 'bearer'
  }
}

beforeEach(() => {
  vi.stubEnv('PSN_NPSSO', 'test-npsso')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('PsnAuthService.getAuthorization', () => {
  it('returns the cached access token without calling PSN', async () => {
    const { cache } = fakeCache({ 'psn:access-token': 'cached-access' })

    const auth = await new PsnAuthService(cache).getAuthorization()

    expect(auth).toEqual({ accessToken: 'cached-access' })
    expect(exchangeRefreshTokenForAuthTokens).not.toHaveBeenCalled()
    expect(exchangeNpssoForAccessCode).not.toHaveBeenCalled()
  })

  it('uses the refresh token when the access token expired', async () => {
    const { cache, store } = fakeCache({ 'psn:refresh-token': 'old-refresh' })
    vi.mocked(exchangeRefreshTokenForAuthTokens).mockResolvedValue(tokens('new'))

    const auth = await new PsnAuthService(cache).getAuthorization()

    expect(exchangeRefreshTokenForAuthTokens).toHaveBeenCalledWith('old-refresh')
    expect(exchangeNpssoForAccessCode).not.toHaveBeenCalled()
    expect(auth).toEqual({ accessToken: 'access-new' })
    expect(store.get('psn:access-token')).toBe('access-new')
    expect(store.get('psn:refresh-token')).toBe('refresh-new')
  })

  it('falls back to the NPSSO when the refresh token exchange fails', async () => {
    const { cache } = fakeCache({ 'psn:refresh-token': 'dead-refresh' })
    vi.mocked(exchangeRefreshTokenForAuthTokens).mockRejectedValue(new Error('invalid_grant'))
    vi.mocked(exchangeNpssoForAccessCode).mockResolvedValue('access-code')
    vi.mocked(exchangeAccessCodeForAuthTokens).mockResolvedValue(tokens('npsso'))

    const auth = await new PsnAuthService(cache).getAuthorization()

    expect(exchangeNpssoForAccessCode).toHaveBeenCalledWith('test-npsso')
    expect(auth).toEqual({ accessToken: 'access-npsso' })
  })

  it('stores tokens with a TTL slightly below their expiry', async () => {
    const { cache, spies } = fakeCache()
    vi.mocked(exchangeNpssoForAccessCode).mockResolvedValue('access-code')
    vi.mocked(exchangeAccessCodeForAuthTokens).mockResolvedValue(tokens('npsso'))

    await new PsnAuthService(cache).getAuthorization()

    expect(spies.set).toHaveBeenCalledWith('psn:access-token', 'access-npsso', 3539)
    expect(spies.set).toHaveBeenCalledWith('psn:refresh-token', 'refresh-npsso', 863939)
  })

  it('throws a 503 ClientError when the NPSSO exchange fails', async () => {
    const { cache } = fakeCache()
    vi.mocked(exchangeNpssoForAccessCode).mockRejectedValue(new Error('expired'))

    const promise = new PsnAuthService(cache).getAuthorization()

    await expect(promise).rejects.toBeInstanceOf(ClientError)
    await expect(promise).rejects.toMatchObject({ statusCode: 503 })
  })

  it('throws a 503 ClientError when PSN_NPSSO is not set', async () => {
    vi.stubEnv('PSN_NPSSO', '')
    const { cache } = fakeCache()

    await expect(new PsnAuthService(cache).getAuthorization()).rejects.toMatchObject({
      statusCode: 503
    })
    expect(exchangeNpssoForAccessCode).not.toHaveBeenCalled()
  })

  it('renews only once when called concurrently', async () => {
    const { cache } = fakeCache()
    vi.mocked(exchangeNpssoForAccessCode).mockResolvedValue('access-code')
    vi.mocked(exchangeAccessCodeForAuthTokens).mockResolvedValue(tokens('npsso'))
    const service = new PsnAuthService(cache)

    const [a, b] = await Promise.all([
      service.getAuthorization(),
      service.getAuthorization()
    ])

    expect(a).toEqual(b)
    expect(exchangeNpssoForAccessCode).toHaveBeenCalledTimes(1)
  })
})

describe('PsnAuthService.invalidateAccessToken', () => {
  it('forces the next call to renew', async () => {
    const { cache } = fakeCache({
      'psn:access-token': 'stale',
      'psn:refresh-token': 'refresh'
    })
    vi.mocked(exchangeRefreshTokenForAuthTokens).mockResolvedValue(tokens('fresh'))
    const service = new PsnAuthService(cache)

    await service.invalidateAccessToken()
    const auth = await service.getAuthorization()

    expect(auth).toEqual({ accessToken: 'access-fresh' })
  })
})
