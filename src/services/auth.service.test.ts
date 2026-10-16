import { describe, it, expect, vi } from 'vitest'
import bcrypt from 'bcrypt'
import { JWT } from '@fastify/jwt'
import { AuthService, revokedAccessTokenKey } from './auth.service'
import { AuthRepository } from '../repositories/auth.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'
import { EmailService } from './email.service'

function fakeJwt(overrides: Partial<JWT> = {}): JWT {
  return {
    sign: vi.fn(() => 'signed-token'),
    verify: vi.fn(() => ({ userId: 'user-1' })),
    ...overrides
  } as unknown as JWT
}

function fakeAuthRepository(
  overrides: Partial<AuthRepository> = {}
): AuthRepository {
  return { ...overrides } as unknown as AuthRepository
}

function fakeCache(stored: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(stored),
    getdel: vi.fn().mockResolvedValue(stored),
    set: vi.fn().mockResolvedValue(undefined),
    setIfAbsent: vi.fn().mockResolvedValue(true),
    increment: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(undefined)
  } as unknown as CacheRepository & {
    get: ReturnType<typeof vi.fn>
    getdel: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    increment: ReturnType<typeof vi.fn>
    del: ReturnType<typeof vi.fn>
  }
}

const fakeCacheRepository = fakeCache()

describe('AuthService.validateUser', () => {
  it('throws ClientError when the user does not exist', async () => {
    const authRepository = fakeAuthRepository({
      findByEmail: vi.fn().mockResolvedValue(null)
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    await expect(
      service.validateUser('a@a.com', 'wrong', '1.1.1.1')
    ).rejects.toThrow(ClientError)
  })

  it('throws ClientError when the password does not match', async () => {
    const hashed = await bcrypt.hash('correct-password', 10)
    const authRepository = fakeAuthRepository({
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: '1', userName: 'x', password: hashed })
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    await expect(
      service.validateUser('a@a.com', 'wrong-password', '1.1.1.1')
    ).rejects.toThrow(ClientError)
  })

  it('returns the user when the password matches', async () => {
    const hashed = await bcrypt.hash('correct-password', 10)
    const authRepository = fakeAuthRepository({
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: '1', userName: 'someone', password: hashed })
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    const result = await service.validateUser(
      'a@a.com',
      'correct-password',
      '1.1.1.1'
    )

    expect(result).toEqual({ user: { id: '1', userName: 'someone' } })
  })
})

describe('AuthService.logout', () => {
  const future = () => Math.floor(Date.now() / 1000) + 600

  it('revokes the access token for the time it still has left', async () => {
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({ invalidateToken: vi.fn() }),
      fakeJwt({ verify: vi.fn(() => ({ exp: future() })) }),
      cache
    )

    await service.logout('refresh', 'access')

    expect(cache.set).toHaveBeenCalledWith(
      revokedAccessTokenKey('access'),
      true,
      expect.any(Number)
    )
  })

  it('does nothing about the access token when it is invalid or expired', async () => {
    const cache = fakeCache()
    const invalid = new AuthService(
      fakeAuthRepository({ invalidateToken: vi.fn() }),
      fakeJwt({
        verify: vi.fn(() => {
          throw new Error('invalid token')
        })
      }),
      cache
    )
    const expired = new AuthService(
      fakeAuthRepository({ invalidateToken: vi.fn() }),
      fakeJwt({ verify: vi.fn(() => ({ exp: 1 })) }),
      cache
    )

    await expect(invalid.logout('refresh', 'access')).resolves.toBeUndefined()
    await expect(expired.logout('refresh', 'access')).resolves.toBeUndefined()
    expect(cache.set).not.toHaveBeenCalled()
  })

  it('logs the failure, and still finishes, when Redis cannot store the revocation', async () => {
    const cache = fakeCache()
    cache.set.mockRejectedValue(new Error('redis down'))
    const invalidateToken = vi.fn()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = new AuthService(
      fakeAuthRepository({ invalidateToken }),
      fakeJwt({ verify: vi.fn(() => ({ exp: future() })) }),
      cache
    )

    await expect(service.logout('refresh', 'access')).resolves.toBeUndefined()

    expect(invalidateToken).toHaveBeenCalledWith('refresh')
    expect(logged).toHaveBeenCalledWith(
      '[Auth] access token revocation failed at logout',
      { error: 'redis down' }
    )
    logged.mockRestore()
  })
})

describe('AuthService.validateRefreshToken', () => {
  it('rejects a token already invalidated by logout', async () => {
    const authRepository = fakeAuthRepository({
      findToken: vi.fn().mockResolvedValue({
        isValid: false,
        expiresAt: new Date(Date.now() + 60_000)
      })
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    await expect(service.validateRefreshToken('some-token')).rejects.toThrow(
      ClientError
    )
  })

  it('rejects an expired token', async () => {
    const authRepository = fakeAuthRepository({
      findToken: vi.fn().mockResolvedValue({
        isValid: true,
        expiresAt: new Date(Date.now() - 1000)
      })
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    await expect(service.validateRefreshToken('some-token')).rejects.toThrow(
      ClientError
    )
  })

  it('returns the userId and rotates the token when it is valid', async () => {
    const invalidateToken = vi.fn()
    const authRepository = fakeAuthRepository({
      findToken: vi.fn().mockResolvedValue({
        isValid: true,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      invalidateToken
    })
    const service = new AuthService(
      authRepository,
      fakeJwt({ verify: vi.fn(() => ({ userId: 'user-1' })) }),
      fakeCacheRepository
    )

    const userId = await service.validateRefreshToken('some-token')

    expect(userId).toBe('user-1')
    expect(invalidateToken).toHaveBeenCalledWith('some-token')
  })
})

describe('AuthService.isRefreshTokenActive', () => {
  it('returns null without rotating an invalidated token', async () => {
    const invalidateToken = vi.fn()
    const authRepository = fakeAuthRepository({
      findToken: vi.fn().mockResolvedValue({
        isValid: false,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      invalidateToken
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    const userId = await service.isRefreshTokenActive('some-token')

    expect(userId).toBeNull()
    expect(invalidateToken).not.toHaveBeenCalled()
  })

  it('returns the userId without rotating a valid token', async () => {
    const invalidateToken = vi.fn()
    const authRepository = fakeAuthRepository({
      findToken: vi.fn().mockResolvedValue({
        isValid: true,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      invalidateToken
    })
    const service = new AuthService(
      authRepository,
      fakeJwt({ verify: vi.fn(() => ({ userId: 'user-1' })) }),
      fakeCacheRepository
    )

    const userId = await service.isRefreshTokenActive('some-token')

    expect(userId).toBe('user-1')
    expect(invalidateToken).not.toHaveBeenCalled()
  })
})

describe('AuthService.createUser', () => {
  it('throws ClientError when the email is already used', async () => {
    const authRepository = fakeAuthRepository({
      findByEmail: vi.fn().mockResolvedValue({ id: 'existing' })
    })
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      fakeCacheRepository
    )

    await expect(
      service.createUser({ email: 'a@a.com', password: 'senha123' })
    ).rejects.toThrow(ClientError)
  })
})

const recordingCache = fakeCache

describe('AuthService.loginWithGoogle', () => {
  const profile = {
    sub: 'google-1',
    email: 'victim@a.com',
    name: 'Victim',
    picture: 'https://example.com/p.png'
  }

  it('rejects an unverified email instead of linking or creating', async () => {
    const findByEmail = vi.fn()
    const authRepository = fakeAuthRepository({
      findUserByGoogleId: vi.fn().mockResolvedValue(null),
      findByEmail
    })
    const service = new AuthService(authRepository, fakeJwt(), recordingCache())

    await expect(
      service.loginWithGoogle({ ...profile, email_verified: false })
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(findByEmail).not.toHaveBeenCalled()
  })

  it('drops the old password and sessions before linking a password account', async () => {
    const updatePassword = vi.fn()
    const deleteTokensByUserId = vi.fn()
    const linkGoogle = vi.fn().mockResolvedValue({ id: 'user-1' })
    const cache = recordingCache()
    const authRepository = fakeAuthRepository({
      findUserByGoogleId: vi.fn().mockResolvedValue(null),
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', googleId: null, discordId: null }),
      updatePassword,
      deleteTokensByUserId,
      linkGoogle,
      markEmailVerified: vi.fn(),
      saveToken: vi.fn()
    })
    const service = new AuthService(authRepository, fakeJwt(), cache)

    await service.loginWithGoogle({ ...profile, email_verified: true })

    expect(updatePassword).toHaveBeenCalledWith('user-1', expect.any(String))
    expect(deleteTokensByUserId).toHaveBeenCalledWith('user-1')
    expect(cache.set).toHaveBeenCalledWith(
      'sessions-revoked-at:user-1',
      expect.any(Number),
      expect.any(Number)
    )
    expect(linkGoogle).toHaveBeenCalledWith(
      'user-1',
      'google-1',
      profile.picture
    )
  })

  it('logs in by googleId without checking the email again', async () => {
    const updatePassword = vi.fn()
    const authRepository = fakeAuthRepository({
      findUserByGoogleId: vi.fn().mockResolvedValue({ id: 'user-1' }),
      updatePassword,
      saveToken: vi.fn()
    })
    const service = new AuthService(authRepository, fakeJwt(), recordingCache())

    const result = await service.loginWithGoogle({
      ...profile,
      email_verified: false
    })

    expect(result.user).toEqual({ id: 'user-1' })
    expect(updatePassword).not.toHaveBeenCalled()
  })
})

describe('AuthService.loginWithDiscord', () => {
  it('rejects an unverified email instead of linking or creating', async () => {
    const findByEmail = vi.fn()
    const authRepository = fakeAuthRepository({
      findByDiscordId: vi.fn().mockResolvedValue(null),
      findByEmail
    })
    const service = new AuthService(authRepository, fakeJwt(), recordingCache())

    await expect(
      service.loginWithDiscord({
        id: 'discord-1',
        email: 'victim@a.com',
        verified: false,
        username: 'x',
        avatar: null
      })
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(findByEmail).not.toHaveBeenCalled()
  })
})

describe('AuthService.resetPassword', () => {
  it('revokes every session of the user after changing the password', async () => {
    const deleteTokensByUserId = vi.fn()
    const cache = recordingCache('user-1')
    const markEmailVerified = vi.fn()
    const authRepository = fakeAuthRepository({
      updatePassword: vi.fn().mockResolvedValue({ email: 'a@a.com' }),
      markEmailVerified,
      deleteTokensByUserId
    })
    const service = new AuthService(authRepository, fakeJwt(), cache)

    await service.resetPassword('reset-token', 'new-password', '1.1.1.1')

    expect(markEmailVerified).toHaveBeenCalledWith('user-1')
    expect(deleteTokensByUserId).toHaveBeenCalledWith('user-1')
    expect(cache.set).toHaveBeenCalledWith(
      'sessions-revoked-at:user-1',
      expect.any(Number),
      expect.any(Number)
    )
  })
})

describe('AuthService.requestPasswordReset', () => {
  it('does not fail when the email cannot be delivered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const cache = recordingCache()
    const authRepository = fakeAuthRepository({
      findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@a.com' })
    })
    const emailService = {
      sendPasswordResetEmail: vi.fn().mockRejectedValue(new Error('no api key'))
    } as unknown as EmailService
    const service = new AuthService(
      authRepository,
      fakeJwt(),
      cache,
      emailService
    )

    await expect(
      service.requestPasswordReset('a@a.com')
    ).resolves.toBeUndefined()
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^password-reset:/),
      'user-1',
      expect.any(Number)
    )
    vi.restoreAllMocks()
  })
})

describe('AuthService.validateUser throttling', () => {
  it('counts a failed login against the email', async () => {
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({ findByEmail: vi.fn().mockResolvedValue(null) }),
      fakeJwt(),
      cache
    )

    await expect(
      service.validateUser('A@a.com', 'wrong', '1.1.1.1')
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(cache.increment).toHaveBeenCalledWith(
      expect.stringMatching(/^login-failures:[0-9a-f]{64}$/),
      expect.any(Number)
    )
  })

  it('blocks the email after too many failures without checking the password', async () => {
    const findByEmail = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      fakeCache(10)
    )

    await expect(
      service.validateUser('a@a.com', 'correct-password', '1.1.1.1')
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(findByEmail).not.toHaveBeenCalled()
  })

  it('clears the failure count and marks a recent login on success', async () => {
    const hashed = await bcrypt.hash('correct-password', 4)
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: '1', userName: 'x', password: hashed })
      }),
      fakeJwt(),
      cache
    )

    await service.validateUser('a@a.com', 'correct-password', '1.1.1.1')

    expect(cache.del).toHaveBeenCalledWith(
      expect.stringMatching(/^login-failures:/)
    )
    expect(cache.set).toHaveBeenCalledWith(
      'recent-auth:1',
      true,
      expect.any(Number)
    )
  })
})

describe('AuthService password reset tokens', () => {
  it('stores the reset token as a hash, never in clear', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const cache = fakeCache()
    let sentUrl = ''
    const emailService = {
      sendPasswordResetEmail: vi.fn(async (_to: string, url: string) => {
        sentUrl = url
      })
    } as unknown as EmailService
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', email: 'a@a.com' })
      }),
      fakeJwt(),
      cache,
      emailService
    )

    await service.requestPasswordReset('a@a.com')

    const token = new URL(sentUrl).searchParams.get('token') as string
    const resetCall = cache.set.mock.calls.find(([key]) =>
      String(key).startsWith('password-reset:')
    )
    expect(resetCall?.[0]).toMatch(/^password-reset:[0-9a-f]{64}$/)
    expect(resetCall?.[0]).not.toContain(token)
    vi.restoreAllMocks()
  })

  it('stops sending after too many requests for the same email', async () => {
    const cache = fakeCache()
    cache.increment.mockResolvedValue(4)
    const emailService = {
      sendPasswordResetEmail: vi.fn()
    } as unknown as EmailService
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', email: 'a@a.com' })
      }),
      fakeJwt(),
      cache,
      emailService
    )

    await service.requestPasswordReset('a@a.com')

    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('consumes the reset token atomically and rejects a reused one', async () => {
    const cache = fakeCache(null)
    const updatePassword = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({ updatePassword }),
      fakeJwt(),
      cache
    )

    await expect(
      service.resetPassword('used-token', 'new-password-1', '1.1.1.1')
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(cache.getdel).toHaveBeenCalledTimes(1)
    expect(updatePassword).not.toHaveBeenCalled()
  })
})

describe('AuthService.isPasswordResetTokenValid', () => {
  it('reports a stored token as valid without consuming it', async () => {
    const cache = fakeCache('user-1')
    const service = new AuthService(fakeAuthRepository(), fakeJwt(), cache)

    expect(await service.isPasswordResetTokenValid('token')).toBe(true)
    expect(cache.getdel).not.toHaveBeenCalled()
    expect(cache.del).not.toHaveBeenCalled()
  })

  it('reports an unknown or used token as invalid', async () => {
    const service = new AuthService(
      fakeAuthRepository(),
      fakeJwt(),
      fakeCache(null)
    )

    expect(await service.isPasswordResetTokenValid('token')).toBe(false)
  })
})

describe('AuthService.validateUser lockout scopes', () => {
  function cacheWithCounts(counts: Record<string, number>) {
    const cache = fakeCache()
    cache.get.mockImplementation(async (key: string) => counts[key] ?? null)
    return cache
  }

  const ipKey = (cache: ReturnType<typeof fakeCache>) =>
    cache.increment.mock.calls
      .map(([key]) => key as string)
      .find(k => k.split(':').length === 3)!
  const emailKey = (cache: ReturnType<typeof fakeCache>) =>
    cache.increment.mock.calls
      .map(([key]) => key as string)
      .find(k => k.split(':').length === 2)!

  async function failedLoginKeys(ip: string) {
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({ findByEmail: vi.fn().mockResolvedValue(null) }),
      fakeJwt(),
      cache
    )
    await service.validateUser('a@a.com', 'wrong', ip).catch(() => undefined)
    return { ip: ipKey(cache), email: emailKey(cache) }
  }

  it('blocks one IP after 10 failures without blocking another IP for the same email', async () => {
    const attacker = await failedLoginKeys('9.9.9.9')
    const other = await failedLoginKeys('2.2.2.2')
    expect(attacker.ip).not.toBe(other.ip)
    expect(attacker.email).toBe(other.email)

    const findByEmail = vi.fn().mockResolvedValue(null)
    const blocked = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      cacheWithCounts({ [attacker.ip]: 10 })
    )
    await expect(
      blocked.validateUser('a@a.com', 'x', '9.9.9.9')
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(findByEmail).not.toHaveBeenCalled()

    const allowed = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      cacheWithCounts({ [attacker.ip]: 10 })
    )
    await expect(
      allowed.validateUser('a@a.com', 'x', '2.2.2.2')
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(findByEmail).toHaveBeenCalledTimes(1)
  })

  it('blocks every IP once the email reaches 50 failures', async () => {
    const keys = await failedLoginKeys('9.9.9.9')
    const findByEmail = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      cacheWithCounts({ [keys.email]: 50 })
    )

    await expect(
      service.validateUser('a@a.com', 'x', '3.3.3.3')
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(findByEmail).not.toHaveBeenCalled()
  })

  it('counts a failure against both the email+IP key and the email key', async () => {
    const keys = await failedLoginKeys('9.9.9.9')
    expect(keys.ip).toMatch(/^login-failures:[0-9a-f]{64}:[0-9a-f]{64}$/)
    expect(keys.email).toMatch(/^login-failures:[0-9a-f]{64}$/)
  })

  it('clears only the email+IP counter on success', async () => {
    const hashed = await bcrypt.hash('correct-password', 4)
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: '1', userName: 'x', password: hashed })
      }),
      fakeJwt(),
      cache
    )

    await service.validateUser('a@a.com', 'correct-password', '1.1.1.1')

    expect(cache.del).toHaveBeenCalledTimes(1)
    expect(cache.del).toHaveBeenCalledWith(
      expect.stringMatching(/^login-failures:[0-9a-f]{64}:[0-9a-f]{64}$/)
    )
  })

  it('does not apply the email-wide limit to an IP that logged in before', async () => {
    const keys = await failedLoginKeys('7.7.7.7')
    const cache = fakeCache()
    cache.get.mockImplementation(async (key: string) => {
      if (key === keys.email) return 50
      if (key.startsWith('login-familiar-ip:')) return true
      return null
    })
    const findByEmail = vi.fn().mockResolvedValue(null)
    const service = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      cache
    )

    await expect(
      service.validateUser('a@a.com', 'x', '7.7.7.7')
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(findByEmail).toHaveBeenCalledTimes(1)
    expect(cache.increment).toHaveBeenCalledTimes(1)
    expect(cache.increment).toHaveBeenCalledWith(keys.ip, expect.any(Number))
  })

  it('still blocks a familiar IP at its own limit', async () => {
    const keys = await failedLoginKeys('7.7.7.7')
    const cache = fakeCache()
    cache.get.mockImplementation(async (key: string) => {
      if (key === keys.ip) return 10
      if (key.startsWith('login-familiar-ip:')) return true
      return null
    })
    const findByEmail = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({ findByEmail }),
      fakeJwt(),
      cache
    )

    await expect(
      service.validateUser('a@a.com', 'x', '7.7.7.7')
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(findByEmail).not.toHaveBeenCalled()
  })

  it('remembers the IP for 30 days after a successful login', async () => {
    const hashed = await bcrypt.hash('correct-password', 4)
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: '1', userName: 'x', password: hashed })
      }),
      fakeJwt(),
      cache
    )

    await service.validateUser('a@a.com', 'correct-password', '7.7.7.7')

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^login-familiar-ip:[0-9a-f]{64}:[0-9a-f]{64}$/),
      true,
      30 * 24 * 60 * 60
    )
  })

  it('lifts both counters when the password is reset', async () => {
    const failed = await failedLoginKeys('1.1.1.1')
    const cache = fakeCache('user-1')
    const service = new AuthService(
      fakeAuthRepository({
        updatePassword: vi.fn().mockResolvedValue({ email: 'a@a.com' }),
        markEmailVerified: vi.fn(),
        deleteTokensByUserId: vi.fn()
      }),
      fakeJwt(),
      cache
    )

    await service.resetPassword('reset-token', 'new-password-1', '1.1.1.1')

    expect(cache.del).toHaveBeenCalledWith(failed.ip)
    expect(cache.del).toHaveBeenCalledWith(failed.email)
  })
})

describe('AuthService email verification', () => {
  function emailServiceMock(send = vi.fn().mockResolvedValue(undefined)) {
    return {
      sendEmailVerificationEmail: send,
      sendPasswordResetEmail: vi.fn()
    } as unknown as EmailService
  }

  function tokenFrom(send: ReturnType<typeof vi.fn>) {
    const url = send.mock.calls[0][1] as string
    return new URL(url).searchParams.get('token') as string
  }

  it('sends a verification email on signup and stores only the hash of the token', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi.fn().mockResolvedValue(null),
        createUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
        saveToken: vi.fn()
      }),
      fakeJwt(),
      cache,
      emailServiceMock(send)
    )

    await service.createUser({ email: 'a@a.com', password: 'k3!fgh-long-pw' })

    const token = tokenFrom(send)
    expect(send).toHaveBeenCalledWith(
      'a@a.com',
      expect.stringContaining('/verify-email?token=')
    )
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^email-verification:[0-9a-f]{64}$/),
      'user-1',
      24 * 60 * 60
    )
    const storedKeys = cache.set.mock.calls.map(([key]) => String(key))
    expect(storedKeys.some(key => key.includes(token))).toBe(false)
  })

  it('does not fail the signup when the email cannot be delivered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const service = new AuthService(
      fakeAuthRepository({
        findByEmail: vi.fn().mockResolvedValue(null),
        createUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
        saveToken: vi.fn()
      }),
      fakeJwt(),
      fakeCache(),
      emailServiceMock(vi.fn().mockRejectedValue(new Error('no api key')))
    )

    await expect(
      service.createUser({ email: 'a@a.com', password: 'k3!fgh-long-pw' })
    ).resolves.toMatchObject({ user: { id: 'user-1' } })
    vi.restoreAllMocks()
  })

  it('marks the account as verified with a valid token and consumes it', async () => {
    const markEmailVerified = vi.fn()
    const cache = fakeCache('user-1')
    const service = new AuthService(
      fakeAuthRepository({ markEmailVerified }),
      fakeJwt(),
      cache
    )

    await service.verifyEmail('some-token')

    expect(cache.getdel).toHaveBeenCalledWith(
      expect.stringMatching(/^email-verification:[0-9a-f]{64}$/)
    )
    expect(markEmailVerified).toHaveBeenCalledWith('user-1')
  })

  it('rejects an unknown or already used token', async () => {
    const markEmailVerified = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({ markEmailVerified }),
      fakeJwt(),
      fakeCache(null)
    )

    await expect(service.verifyEmail('used-token')).rejects.toMatchObject({
      statusCode: 400
    })
    expect(markEmailVerified).not.toHaveBeenCalled()
  })

  it('invalidates the previous link when a new one is sent', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const cache = fakeCache()
    cache.get.mockResolvedValue('previous-hash')
    const service = new AuthService(
      fakeAuthRepository({
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'a@a.com',
          emailVerifiedAt: null
        })
      }),
      fakeJwt(),
      cache,
      emailServiceMock(send)
    )

    await service.resendEmailVerification('user-1')

    expect(cache.del).toHaveBeenCalledWith('email-verification:previous-hash')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous link working when the new one cannot be delivered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const cache = fakeCache()
    cache.get.mockResolvedValue('previous-hash')
    const service = new AuthService(
      fakeAuthRepository({
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'a@a.com',
          emailVerifiedAt: null
        })
      }),
      fakeJwt(),
      cache,
      emailServiceMock(vi.fn().mockRejectedValue(new Error('no api key')))
    )

    await expect(
      service.resendEmailVerification('user-1')
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(cache.del).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('does not resend to an account that is already verified', async () => {
    const send = vi.fn()
    const cache = fakeCache()
    const service = new AuthService(
      fakeAuthRepository({
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'a@a.com',
          emailVerifiedAt: new Date()
        })
      }),
      fakeJwt(),
      cache,
      emailServiceMock(send)
    )

    await service.resendEmailVerification('user-1')

    expect(send).not.toHaveBeenCalled()
    expect(cache.increment).not.toHaveBeenCalled()
  })

  it('stops resending after 3 requests in an hour', async () => {
    const send = vi.fn()
    const cache = fakeCache()
    cache.increment.mockResolvedValue(4)
    const service = new AuthService(
      fakeAuthRepository({
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'a@a.com',
          emailVerifiedAt: null
        })
      }),
      fakeJwt(),
      cache,
      emailServiceMock(send)
    )

    await expect(
      service.resendEmailVerification('user-1')
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(send).not.toHaveBeenCalled()
  })

  it('tells the user when the resend could not be delivered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const service = new AuthService(
      fakeAuthRepository({
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'a@a.com',
          emailVerifiedAt: null
        })
      }),
      fakeJwt(),
      fakeCache(),
      emailServiceMock(vi.fn().mockRejectedValue(new Error('no api key')))
    )

    await expect(
      service.resendEmailVerification('user-1')
    ).rejects.toMatchObject({ statusCode: 503 })
    vi.restoreAllMocks()
  })
})

describe('AuthService provider linking', () => {
  const googleProfile = {
    sub: 'google-1',
    email: 'user@a.com',
    email_verified: true,
    name: 'User',
    picture: 'https://example.com/p.png'
  }

  function googleSetup(existing: { discordId: string | null }) {
    const updatePassword = vi.fn()
    const deleteTokensByUserId = vi.fn()
    const markEmailVerified = vi.fn()
    const authRepository = fakeAuthRepository({
      findUserByGoogleId: vi.fn().mockResolvedValue(null),
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', googleId: null, ...existing }),
      linkGoogle: vi.fn().mockResolvedValue({ id: 'user-1' }),
      updatePassword,
      deleteTokensByUserId,
      markEmailVerified,
      saveToken: vi.fn()
    })
    const service = new AuthService(authRepository, fakeJwt(), fakeCache())
    return { service, updatePassword, deleteTokensByUserId, markEmailVerified }
  }

  it('drops the password of a password-only account even when its email was verified by link', async () => {
    const { service, updatePassword, deleteTokensByUserId, markEmailVerified } =
      googleSetup({ discordId: null })

    await service.loginWithGoogle(googleProfile)

    expect(updatePassword).toHaveBeenCalledWith('user-1', expect.any(String))
    expect(deleteTokensByUserId).toHaveBeenCalledWith('user-1')
    expect(markEmailVerified).toHaveBeenCalledWith('user-1')
  })

  it('keeps the password and sessions of an account that already has another provider', async () => {
    const { service, updatePassword, deleteTokensByUserId, markEmailVerified } =
      googleSetup({ discordId: 'discord-1' })

    await service.loginWithGoogle(googleProfile)

    expect(updatePassword).not.toHaveBeenCalled()
    expect(deleteTokensByUserId).not.toHaveBeenCalled()
    expect(markEmailVerified).toHaveBeenCalledWith('user-1')
  })

  it.each([
    ['a password-only account', null, true],
    ['an account that already has Google', 'google-1', false]
  ])('links Discord to %s', async (_label, googleId, expectsTakeOver) => {
    const updatePassword = vi.fn()
    const markEmailVerified = vi.fn()
    const linkDiscord = vi.fn().mockResolvedValue({ id: 'user-1' })
    const service = new AuthService(
      fakeAuthRepository({
        findByDiscordId: vi.fn().mockResolvedValue(null),
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', googleId, discordId: null }),
        linkDiscord,
        updatePassword,
        deleteTokensByUserId: vi.fn(),
        markEmailVerified,
        saveToken: vi.fn()
      }),
      fakeJwt(),
      fakeCache()
    )

    await service.loginWithDiscord({
      id: 'discord-1',
      email: 'user@a.com',
      verified: true,
      username: 'user',
      avatar: null
    })

    expect(linkDiscord).toHaveBeenCalledWith('user-1', 'discord-1', null)
    expect(updatePassword).toHaveBeenCalledTimes(expectsTakeOver ? 1 : 0)
    expect(markEmailVerified).toHaveBeenCalledWith('user-1')
  })
})

describe('AuthService provider already linked', () => {
  it('refuses to replace the Google account already linked to that email', async () => {
    const linkGoogle = vi.fn()
    const updatePassword = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({
        findUserByGoogleId: vi.fn().mockResolvedValue(null),
        findByEmail: vi.fn().mockResolvedValue({
          id: 'user-1',
          googleId: 'another-google-account',
          discordId: null
        }),
        linkGoogle,
        updatePassword
      }),
      fakeJwt(),
      fakeCache()
    )

    await expect(
      service.loginWithGoogle({
        sub: 'google-2',
        email: 'user@a.com',
        email_verified: true,
        name: 'User',
        picture: 'https://example.com/p.png'
      })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(linkGoogle).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('refuses to replace the Discord account already linked to that email', async () => {
    const linkDiscord = vi.fn()
    const updatePassword = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({
        findByDiscordId: vi.fn().mockResolvedValue(null),
        findByEmail: vi.fn().mockResolvedValue({
          id: 'user-1',
          googleId: null,
          discordId: 'another-discord-account'
        }),
        linkDiscord,
        updatePassword
      }),
      fakeJwt(),
      fakeCache()
    )

    await expect(
      service.loginWithDiscord({
        id: 'discord-2',
        email: 'user@a.com',
        verified: true,
        username: 'user',
        avatar: null
      })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(linkDiscord).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
  })
})

describe('AuthService provider emails', () => {
  it('looks up and creates the Google account with a lowercase email', async () => {
    const findByEmail = vi.fn().mockResolvedValue(null)
    const createUserWithGoogle = vi.fn().mockResolvedValue({ id: 'user-1' })
    const service = new AuthService(
      fakeAuthRepository({
        findUserByGoogleId: vi.fn().mockResolvedValue(null),
        findByEmail,
        createUserWithGoogle,
        saveToken: vi.fn()
      }),
      fakeJwt(),
      fakeCache()
    )

    const result = await service.loginWithGoogle({
      sub: 'google-1',
      email: 'Ana@Mail.COM',
      email_verified: true,
      name: 'Ana',
      picture: 'https://example.com/p.png'
    })

    expect(findByEmail).toHaveBeenCalledWith('ana@mail.com')
    expect(createUserWithGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@mail.com' })
    )
    expect(result.user).toMatchObject({ email: 'ana@mail.com' })
  })

  it('looks up and creates the Discord account with a lowercase email', async () => {
    const findByEmail = vi.fn().mockResolvedValue(null)
    const createWithDiscord = vi.fn().mockResolvedValue({ id: 'user-1' })
    const service = new AuthService(
      fakeAuthRepository({
        findByDiscordId: vi.fn().mockResolvedValue(null),
        findByEmail,
        createWithDiscord,
        saveToken: vi.fn()
      }),
      fakeJwt(),
      fakeCache()
    )

    await service.loginWithDiscord({
      id: 'discord-1',
      email: 'Ana@Mail.COM',
      verified: true,
      username: 'ana',
      avatar: null
    })

    expect(findByEmail).toHaveBeenCalledWith('ana@mail.com')
    expect(createWithDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@mail.com' })
    )
  })
})

describe('AuthService token types', () => {
  const activeToken = {
    isValid: true,
    expiresAt: new Date(Date.now() + 60_000)
  }

  it('signs the access and refresh tokens with different types', async () => {
    const sign = vi.fn(() => 'signed-token')
    const service = new AuthService(
      fakeAuthRepository({ saveToken: vi.fn() }),
      fakeJwt({ sign } as Partial<JWT>),
      fakeCache()
    )

    await service.generateTokens('user-1')

    expect(sign).toHaveBeenCalledWith(
      { userId: 'user-1', tokenType: 'access' },
      expect.anything()
    )
    expect(sign).toHaveBeenCalledWith(
      { userId: 'user-1', tokenType: 'refresh', jti: expect.any(String) },
      expect.anything()
    )
  })

  it('gives every refresh token its own jti so tokens signed in the same second differ', async () => {
    const sign = vi.fn<(payload: object, options?: object) => string>(
      () => 'signed-token'
    )
    const service = new AuthService(
      fakeAuthRepository({ saveToken: vi.fn() }),
      fakeJwt({ sign } as Partial<JWT>),
      fakeCache()
    )

    await service.generateTokens('user-1')
    await service.generateTokens('user-1')

    const jtis = sign.mock.calls
      .map(([payload]) => (payload as { jti?: string }).jti)
      .filter(Boolean)
    expect(jtis).toHaveLength(2)
    expect(jtis[0]).not.toBe(jtis[1])
  })

  it('does not accept an access token as a refresh token', async () => {
    const invalidateToken = vi.fn()
    const service = new AuthService(
      fakeAuthRepository({
        findToken: vi.fn().mockResolvedValue(activeToken),
        invalidateToken
      }),
      fakeJwt({
        verify: vi.fn(() => ({ userId: 'user-1', tokenType: 'access' }))
      } as Partial<JWT>),
      fakeCache()
    )

    await expect(
      service.validateRefreshToken('some-token')
    ).rejects.toMatchObject({ statusCode: 401 })
    expect(await service.isRefreshTokenActive('some-token')).toBeNull()
    expect(invalidateToken).not.toHaveBeenCalled()
  })

  it('still accepts a refresh token issued before token types existed', async () => {
    const service = new AuthService(
      fakeAuthRepository({ findToken: vi.fn().mockResolvedValue(activeToken) }),
      fakeJwt({ verify: vi.fn(() => ({ userId: 'user-1' })) } as Partial<JWT>),
      fakeCache()
    )

    expect(await service.isRefreshTokenActive('some-token')).toBe('user-1')
  })
})
