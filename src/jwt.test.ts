import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll
} from 'vitest'
import fastify, { FastifyInstance } from 'fastify'

const cache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))
const authRepository = vi.hoisted(() => ({
  findToken: vi.fn()
}))

vi.mock('./repositories/cache.repository', () => ({
  CacheRepository: class {
    get = cache.get
    set = cache.set
    del = cache.del
  }
}))
vi.mock('./repositories/auth.repository', () => ({
  AuthRepository: class {
    findToken = authRepository.findToken
  }
}))

import { Jwt } from './jwt'
import { revokedAccessTokenKey } from './services/auth.service'
import { sessionsRevokedAtKey } from './utils/session-revocation'

let app: FastifyInstance

function accessToken(userId = 'user-1') {
  return app.jwt.sign({ userId, tokenType: 'access' })
}

function refreshToken(userId = 'user-1') {
  return app.jwt.sign(
    { userId, tokenType: 'refresh', jti: crypto.randomUUID() },
    { expiresIn: '7d' }
  )
}

function expiredAccessToken(userId = 'user-1') {
  const token = accessToken(userId)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 16 * 60 * 1000)
  return token
}

function activeRefreshRow() {
  return { isValid: true, expiresAt: new Date(Date.now() + 60_000) }
}

function storedValues(values: Record<string, unknown>) {
  cache.get.mockImplementation(async (key: string) => values[key] ?? null)
}

beforeAll(async () => {
  process.env.SECRET_JWT_KEY = 'test-secret-with-more-than-32-characters'
  process.env.FRONTEND_URL = 'http://localhost:5173'

  app = fastify()
  Jwt.initSetup(app)
  app.get('/private', { preHandler: [app.authenticate] }, async request => ({
    userId: request.user.userId
  }))
  app.get('/public', { preHandler: [app.tryAuthenticate] }, async request => ({
    userId: request.user?.userId ?? null
  }))
  await app.ready()
})

beforeEach(() => {
  cache.get.mockReset().mockResolvedValue(null)
  authRepository.findToken.mockReset().mockResolvedValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

afterAll(async () => {
  await app.close()
})

describe('app.authenticate', () => {
  it('accepts a valid access token sent in the cookie', async () => {
    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: accessToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-1' })
  })

  it('does not accept an access token sent in the Authorization header', async () => {
    const response = await app.inject({
      url: '/private',
      headers: { authorization: `Bearer ${accessToken()}` }
    })

    expect(response.statusCode).toBe(401)
  })

  it('uses the cookie when the header carries another token', async () => {
    const response = await app.inject({
      url: '/private',
      headers: { authorization: `Bearer ${accessToken('user-1')}` },
      cookies: { accessToken: accessToken('user-2') }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-2' })
  })

  it('rejects a token revoked at logout and clears the cookies', async () => {
    const token = accessToken()
    storedValues({ [revokedAccessTokenKey(token)]: true })

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: token }
    })

    expect(response.statusCode).toBe(401)
    expect(String(response.headers['set-cookie'])).toContain('accessToken=;')
  })

  it('rejects a revoked token even when the header carries a valid one', async () => {
    const revoked = accessToken()
    storedValues({ [revokedAccessTokenKey(revoked)]: true })

    const response = await app.inject({
      url: '/private',
      headers: { authorization: `Bearer ${accessToken('user-2')}` },
      cookies: { accessToken: revoked }
    })

    expect(response.statusCode).toBe(401)
  })

  it('rejects a token issued before every session of the user was revoked', async () => {
    storedValues({
      [sessionsRevokedAtKey('user-1')]: Math.floor(Date.now() / 1000) + 60
    })

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: accessToken() }
    })

    expect(response.statusCode).toBe(401)
  })

  it('rejects a refresh token used as an access token', async () => {
    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: refreshToken() }
    })

    expect(response.statusCode).toBe(401)
  })

  it('answers 503 when the revocation check cannot be made', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    cache.get.mockRejectedValue(new Error('redis down'))

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: accessToken() }
    })

    expect(response.statusCode).toBe(503)
  })

  it('renews the access token from an active refresh token when the access cookie is missing', async () => {
    authRepository.findToken.mockResolvedValue({
      isValid: true,
      expiresAt: new Date(Date.now() + 60_000)
    })

    const response = await app.inject({
      url: '/private',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-1' })
    expect(String(response.headers['set-cookie'])).toMatch(/accessToken=ey/)
  })

  it('ignores the header token and identifies the user by the refresh cookie', async () => {
    authRepository.findToken.mockResolvedValue({
      isValid: true,
      expiresAt: new Date(Date.now() + 60_000)
    })

    const response = await app.inject({
      url: '/private',
      headers: { authorization: `Bearer ${accessToken('user-1')}` },
      cookies: { refreshToken: refreshToken('user-2') }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-2' })
  })

  it('rejects a header token when the refresh cookie is not active', async () => {
    const response = await app.inject({
      url: '/private',
      headers: { authorization: `Bearer ${accessToken()}` },
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(401)
  })

  it('rejects when the access cookie is missing and the refresh token is not active', async () => {
    const response = await app.inject({
      url: '/private',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(401)
  })

  it('renews the session when the access cookie is still there but its token expired', async () => {
    const expired = expiredAccessToken()
    authRepository.findToken.mockResolvedValue(activeRefreshRow())

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: expired, refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-1' })
    expect(String(response.headers['set-cookie'])).toMatch(/accessToken=ey/)
  })

  it('rejects an expired access token when the refresh token is not active', async () => {
    const expired = expiredAccessToken()

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: expired, refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(401)
    expect(String(response.headers['set-cookie'])).toContain('refreshToken=;')
  })

  it('rejects an expired access token sent without a refresh cookie', async () => {
    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: expiredAccessToken() }
    })

    expect(response.statusCode).toBe(401)
  })

  it('does not renew when the access cookie was tampered with', async () => {
    authRepository.findToken.mockResolvedValue(activeRefreshRow())
    const token = accessToken()
    const tampered = `${token.slice(0, -4)}AAAA`

    const response = await app.inject({
      url: '/private',
      cookies: { accessToken: tampered, refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(401)
    expect(authRepository.findToken).not.toHaveBeenCalled()
  })

  it('answers 503 and keeps the cookies when the refresh token cannot be checked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    authRepository.findToken.mockRejectedValue(new Error('database down'))

    const response = await app.inject({
      url: '/private',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(503)
    expect(response.headers['retry-after']).toBe('5')
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 'unavailable',
      detail: 'Serviço indisponível no momento. Tente novamente em instantes.',
      message: 'Serviço indisponível no momento. Tente novamente em instantes.'
    })
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('rejects a request with no cookies at all', async () => {
    const response = await app.inject({ url: '/private' })

    expect(response.statusCode).toBe(401)
  })
})

describe('app.tryAuthenticate', () => {
  it('identifies the user from the cookie', async () => {
    const response = await app.inject({
      url: '/public',
      cookies: { accessToken: accessToken() }
    })

    expect(response.json()).toEqual({ userId: 'user-1' })
  })

  it('treats a token sent only in the Authorization header as anonymous', async () => {
    const response = await app.inject({
      url: '/public',
      headers: { authorization: `Bearer ${accessToken()}` }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: null })
  })

  it('treats a revoked token as anonymous', async () => {
    const token = accessToken()
    storedValues({ [revokedAccessTokenKey(token)]: true })

    const response = await app.inject({
      url: '/public',
      cookies: { accessToken: token }
    })

    expect(response.json()).toEqual({ userId: null })
  })

  it('renews the session from an active refresh cookie without rotating it', async () => {
    authRepository.findToken.mockResolvedValue(activeRefreshRow())

    const response = await app.inject({
      url: '/public',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-1' })
    expect(response.headers['set-cookie']).toEqual(
      expect.stringContaining('accessToken=')
    )
    expect(response.headers['set-cookie']).not.toEqual(
      expect.stringContaining('refreshToken=')
    )
  })

  it('renews when the access cookie has expired', async () => {
    const refresh = refreshToken()
    const expired = expiredAccessToken()
    authRepository.findToken.mockResolvedValue(activeRefreshRow())

    const response = await app.inject({
      url: '/public',
      cookies: { accessToken: expired, refreshToken: refresh }
    })

    expect(response.json()).toEqual({ userId: 'user-1' })
    expect(response.headers['set-cookie']).toEqual(
      expect.stringContaining('accessToken=')
    )
  })

  it('stays anonymous and leaves the cookies alone when the refresh token is not active', async () => {
    authRepository.findToken.mockResolvedValue(null)

    const response = await app.inject({
      url: '/public',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: null })
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('stays anonymous and logs when checking the refresh token fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    authRepository.findToken.mockRejectedValue(new Error('database down'))

    const response = await app.inject({
      url: '/public',
      cookies: { refreshToken: refreshToken() }
    })

    expect(response.json()).toEqual({ userId: null })
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(logged).toHaveBeenCalledWith('Optional session renewal failed:', {
      error: 'database down'
    })
  })

  it('does not renew from a tampered access token', async () => {
    authRepository.findToken.mockResolvedValue(activeRefreshRow())
    const tampered = `${accessToken()}x`

    const response = await app.inject({
      url: '/public',
      cookies: { accessToken: tampered, refreshToken: refreshToken() }
    })

    expect(response.json()).toEqual({ userId: null })
    expect(authRepository.findToken).not.toHaveBeenCalled()
  })

  it('treats a failed revocation check as anonymous and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    cache.get.mockRejectedValue(new Error('redis down'))

    const response = await app.inject({
      url: '/public',
      cookies: { accessToken: accessToken() }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: null })
    expect(logged).toHaveBeenCalledWith('Revocation check failed:', {
      error: 'redis down'
    })
  })
})
