import { describe, it, expect, vi } from 'vitest'
import { FastifyReply, FastifyRequest } from 'fastify'
import { UserController } from './users.controller'
import { UserService } from '../services/users.service'
import { CacheRepository } from '../repositories/cache.repository'

function fakeReply() {
  const reply = {
    status: vi.fn(() => reply),
    send: vi.fn(() => reply)
  }
  return reply as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>
    send: ReturnType<typeof vi.fn>
  }
}

function fakeRequest(idempotencyKey?: string) {
  return {
    params: { igdbId: '10' },
    body: { incrementValue: 1 },
    user: { userId: 'user-1' },
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}
  } as unknown as FastifyRequest
}

function setup(cacheOverrides: Partial<CacheRepository> = {}) {
  const updateUserGamePlayedCount = vi
    .fn()
    .mockResolvedValue({ playedCount: 3 })
  const cache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    setIfAbsent: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(undefined),
    ...cacheOverrides
  } as unknown as CacheRepository
  const controller = new UserController(
    { updateUserGamePlayedCount } as unknown as UserService,
    cache
  )
  return { controller, cache, updateUserGamePlayedCount }
}

describe('UserController.updateUserGamePlayedCount', () => {
  it('applies the change and remembers the result under the idempotency key', async () => {
    const { controller, cache, updateUserGamePlayedCount } = setup()
    const reply = fakeReply()

    await controller.updateUserGamePlayedCount(fakeRequest('key-12345'), reply)

    expect(updateUserGamePlayedCount).toHaveBeenCalledTimes(1)
    expect(cache.set).toHaveBeenCalledWith(
      'idempotency:user-1:played-count:10:key-12345',
      { playedCount: 3 },
      expect.any(Number)
    )
    expect(reply.send).toHaveBeenCalledWith({ playedCount: 3 })
  })

  it('returns the remembered result without applying a repeated request', async () => {
    const { controller, updateUserGamePlayedCount } = setup({
      setIfAbsent: vi.fn().mockResolvedValue(false),
      get: vi.fn().mockResolvedValue({ playedCount: 3 })
    })
    const reply = fakeReply()

    await controller.updateUserGamePlayedCount(fakeRequest('key-12345'), reply)

    expect(updateUserGamePlayedCount).not.toHaveBeenCalled()
    expect(reply.send).toHaveBeenCalledWith({ playedCount: 3 })
  })

  it('rejects a repeated request while the first is still running', async () => {
    const { controller, updateUserGamePlayedCount } = setup({
      setIfAbsent: vi.fn().mockResolvedValue(false),
      get: vi.fn().mockResolvedValue('pending')
    })

    await expect(
      controller.updateUserGamePlayedCount(
        fakeRequest('key-12345'),
        fakeReply()
      )
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(updateUserGamePlayedCount).not.toHaveBeenCalled()
  })

  it('applies the change normally when no key is sent', async () => {
    const { controller, cache, updateUserGamePlayedCount } = setup()

    await controller.updateUserGamePlayedCount(fakeRequest(), fakeReply())

    expect(updateUserGamePlayedCount).toHaveBeenCalledTimes(1)
    expect(cache.setIfAbsent).not.toHaveBeenCalled()
  })
})
