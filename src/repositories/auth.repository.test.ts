import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  $queryRaw: vi.fn(),
  refreshToken: {
    updateMany: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn()
  }
}

vi.mock('../database/db', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }
}))

import { AuthRepository } from './auth.repository'

describe('AuthRepository.rotateToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.$queryRaw.mockResolvedValue([{ id: 'user-1' }])
    tx.refreshToken.findMany.mockResolvedValue([])
    tx.refreshToken.count.mockResolvedValue(0)
  })

  it('locks the user row before revoking the old token, so it serializes with a link purge', async () => {
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 })

    await new AuthRepository().rotateToken('old', 'new', 'user-1', new Date())

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.updateMany.mock.invocationCallOrder[0]
    )
  })

  it('answers 401 when the old token was already revoked or purged', async () => {
    tx.refreshToken.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      new AuthRepository().rotateToken('old', 'new', 'user-1', new Date())
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
