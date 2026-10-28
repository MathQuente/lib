import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  userGamePlatform: {
    upsert: vi.fn(),
    findMany: vi.fn()
  },
  userGameStats: { upsert: vi.fn() },
  userGame: { update: vi.fn(), updateMany: vi.fn() }
}

vi.mock('../database/db', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }
}))

import { UserGamePlatformRepository } from './user-game-platform.repository'

const save = () =>
  new UserGamePlatformRepository().savePlatform(
    'user-game-1',
    'PC' as never,
    'PC' as never,
    {}
  )

describe('UserGamePlatformRepository recomputeTotals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets the game date to the earliest platform date', async () => {
    const early = new Date('2024-01-01')
    tx.userGamePlatform.findMany.mockResolvedValue([
      { hoursPlayed: null, completions: 1, completedAt: new Date('2025-01-01') },
      { hoursPlayed: null, completions: 1, completedAt: early }
    ])

    await save()

    expect(tx.userGame.update).toHaveBeenCalledWith({
      where: { id: 'user-game-1' },
      data: { completedAt: early }
    })
    expect(tx.userGame.updateMany).not.toHaveBeenCalled()
  })

  it('clears the game date when no platform has one and there are no completions', async () => {
    tx.userGamePlatform.findMany.mockResolvedValue([
      { hoursPlayed: null, completions: 0, completedAt: null }
    ])

    await save()

    expect(tx.userGame.update).not.toHaveBeenCalled()
    expect(tx.userGame.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-game-1', completedAt: { not: null } },
      data: { completedAt: null }
    })
  })

  it('clears the game date when the last platform is gone', async () => {
    tx.userGamePlatform.findMany.mockResolvedValue([])

    await save()

    expect(tx.userGame.updateMany).toHaveBeenCalledTimes(1)
  })

  it('keeps the game date when a platform has a completion but no date', async () => {
    tx.userGamePlatform.findMany.mockResolvedValue([
      { hoursPlayed: null, completions: 1, completedAt: null }
    ])

    await save()

    expect(tx.userGame.update).not.toHaveBeenCalled()
    expect(tx.userGame.updateMany).not.toHaveBeenCalled()
  })
})
