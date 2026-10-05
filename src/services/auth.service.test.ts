import { describe, it, expect, vi } from 'vitest'
import bcrypt from 'bcrypt'
import { JWT } from '@fastify/jwt'
import { AuthService } from './auth.service'
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

    await expect(service.validateUser('a@a.com', 'wrong')).rejects.toThrow(
      ClientError
    )
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
      service.validateUser('a@a.com', 'wrong-password')
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

    const result = await service.validateUser('a@a.com', 'correct-password')

    expect(result).toEqual({ user: { id: '1', userName: 'someone' } })
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
    const authRepository = fakeAuthRepository({
      updatePassword: vi.fn(),
      deleteTokensByUserId
    })
    const service = new AuthService(authRepository, fakeJwt(), cache)

    await service.resetPassword('reset-token', 'new-password')

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

    await expect(service.validateUser('A@a.com', 'wrong')).rejects.toMatchObject(
      { statusCode: 400 }
    )
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
      service.validateUser('a@a.com', 'correct-password')
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

    await service.validateUser('a@a.com', 'correct-password')

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
        findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@a.com' })
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
        findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@a.com' })
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
      service.resetPassword('used-token', 'new-password-1')
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
