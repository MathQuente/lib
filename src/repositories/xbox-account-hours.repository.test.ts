import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  $queryRaw: vi.fn(),
  userGamePlatform: {
    upsert: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn()
  },
  xboxAccountHours: {
    upsert: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn()
  },
  xboxAccount: { findFirst: vi.fn(), delete: vi.fn() },
  userGameStats: { upsert: vi.fn() },
  userGame: { update: vi.fn(), updateMany: vi.fn() }
}

vi.mock('../database/db', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }
}))

import { UserGamePlatformRepository } from './user-game-platform.repository'

describe('UserGamePlatformRepository account hours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.userGamePlatform.upsert.mockResolvedValue({ id: 'row-1' })
    tx.userGamePlatform.findMany.mockResolvedValue([])
    tx.$queryRaw.mockResolvedValue([{ id: 'account-1' }])
  })

  const save = (accountHours?: { accountId: string; hours: number }) =>
    new UserGamePlatformRepository().savePlatform(
      'user-game-1',
      'XBOX',
      'XBOX_ONE',
      {},
      accountHours
    )

  it('stores the account contribution and sets the row to the sum of all accounts', async () => {
    tx.xboxAccountHours.aggregate.mockResolvedValue({
      _sum: { hoursPlayed: 3 },
      _count: 2
    })

    await save({ accountId: 'acc-2', hours: 1 })

    expect(tx.xboxAccountHours.upsert).toHaveBeenCalledWith({
      where: {
        userGamePlatformId_xboxAccountId: {
          userGamePlatformId: 'row-1',
          xboxAccountId: 'acc-2'
        }
      },
      update: { hoursPlayed: 1 },
      create: {
        userGamePlatformId: 'row-1',
        xboxAccountId: 'acc-2',
        hoursPlayed: 1
      }
    })
    expect(tx.userGamePlatform.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { hoursPlayed: 3 }
    })
  })

  it('reimporting the same hours overwrites the contribution instead of adding to it', async () => {
    tx.xboxAccountHours.aggregate.mockResolvedValue({
      _sum: { hoursPlayed: 2 },
      _count: 1
    })

    await save({ accountId: 'acc-1', hours: 2 })
    await save({ accountId: 'acc-1', hours: 2 })

    expect(tx.xboxAccountHours.upsert).toHaveBeenCalledTimes(2)
    for (const [call] of tx.xboxAccountHours.upsert.mock.calls) {
      expect(call.update).toEqual({ hoursPlayed: 2 })
    }
    expect(tx.userGamePlatform.update).toHaveBeenLastCalledWith({
      where: { id: 'row-1' },
      data: { hoursPlayed: 2 }
    })
  })

  it('skips the contribution and recomputes the row when the account was disconnected meanwhile', async () => {
    tx.$queryRaw.mockResolvedValue([])
    tx.xboxAccountHours.aggregate.mockResolvedValue({
      _sum: { hoursPlayed: null },
      _count: 0
    })

    await save({ accountId: 'acc-gone', hours: 5 })

    expect(tx.xboxAccountHours.upsert).not.toHaveBeenCalled()
    expect(tx.userGamePlatform.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { hoursPlayed: null }
    })
  })

  it('locks the account before touching the platform row, matching the disconnect order', async () => {
    tx.xboxAccountHours.aggregate.mockResolvedValue({
      _sum: { hoursPlayed: 1 },
      _count: 1
    })

    await save({ accountId: 'acc-1', hours: 1 })

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.userGamePlatform.upsert.mock.invocationCallOrder[0]
    )
  })

  it('does not touch contributions or the row hours when the account has no minutes', async () => {
    await save()

    expect(tx.xboxAccountHours.upsert).not.toHaveBeenCalled()
    expect(tx.xboxAccountHours.aggregate).not.toHaveBeenCalled()
    expect(tx.userGamePlatform.update).not.toHaveBeenCalled()
  })
})

describe('UserGamePlatformRepository.removeXboxAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.userGamePlatform.findMany.mockResolvedValue([])
    tx.$queryRaw.mockResolvedValue([{ id: 'acc-2' }])
  })

  it('returns false and changes nothing when the account is not the user\'s', async () => {
    tx.xboxAccount.findFirst.mockResolvedValue(null)

    const removed = await new UserGamePlatformRepository().removeXboxAccount(
      'user-1',
      'acc-9'
    )

    expect(removed).toBe(false)
    expect(tx.xboxAccount.delete).not.toHaveBeenCalled()
  })

  it('recomputes the affected rows from the remaining accounts', async () => {
    tx.xboxAccount.findFirst.mockResolvedValue({ id: 'acc-2' })
    tx.xboxAccountHours.findMany.mockResolvedValue([
      { userGamePlatformId: 'row-1', userGamePlatform: { userGameId: 'ug-1' } },
      { userGamePlatformId: 'row-2', userGamePlatform: { userGameId: 'ug-2' } }
    ])
    tx.xboxAccountHours.aggregate
      .mockResolvedValueOnce({ _sum: { hoursPlayed: 2 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { hoursPlayed: null }, _count: 0 })

    const removed = await new UserGamePlatformRepository().removeXboxAccount(
      'user-1',
      'acc-2'
    )

    expect(removed).toBe(true)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.xboxAccount.delete).toHaveBeenCalledWith({
      where: { id: 'acc-2' }
    })
    expect(tx.userGamePlatform.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { hoursPlayed: 2 }
    })
    expect(tx.userGamePlatform.update).toHaveBeenCalledWith({
      where: { id: 'row-2' },
      data: { hoursPlayed: null }
    })
    expect(tx.userGameStats.upsert).toHaveBeenCalledTimes(2)
  })
})
