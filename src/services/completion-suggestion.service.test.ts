import { describe, it, expect, vi } from 'vitest'
import { ClientError } from '../errors/client-error'
import {
  CompletionSuggestionRepository,
  GameState,
  SuggestionEvidence
} from '../repositories/completion-suggestion.repository'
import { CompletionSuggestionService } from './completion-suggestion.service'

const evidence: SuggestionEvidence = {
  hoursPlayed: 33.8,
  normallyHours: 33.1,
  achieved: 7,
  total: 45,
  signals: ['playtime']
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    statusId: 3,
    completedAt: null,
    completions: 0,
    platformRows: [{ id: 'row-1', completions: 0, completedAt: null }],
    ...overrides
  }
}

function setup(overrides: Record<string, unknown> = {}) {
  const repository = {
    findGameForRecord: vi.fn().mockResolvedValue({
      id: 'ug-1',
      statusId: 3,
      endless: false,
      completions: 0
    }),
    upsertPending: vi.fn().mockResolvedValue(true),
    claimPending: vi.fn().mockResolvedValue(true),
    releaseClaim: vi.fn().mockResolvedValue(undefined),
    listPending: vi.fn().mockResolvedValue([]),
    findByUserAndIgdbId: vi.fn().mockResolvedValue({
      id: 'sug-1',
      userGameId: 'ug-1',
      platform: 'STEAM',
      status: 'PENDING',
      undoSnapshot: null
    }),
    readGameState: vi.fn().mockResolvedValue(state()),
    markDismissed: vi.fn().mockResolvedValue(undefined),
    markAccepted: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue('restored'),
    ...overrides
  }
  const userService = { updateGame: vi.fn().mockResolvedValue(undefined) }
  const platformRepository = {
    markSinglePlatformCompleted: vi.fn().mockResolvedValue(undefined)
  }
  const service = new CompletionSuggestionService(
    repository as unknown as CompletionSuggestionRepository,
    userService,
    platformRepository
  )
  return { service, repository, userService, platformRepository }
}

describe('CompletionSuggestionService.record', () => {
  it('records a pending suggestion for a game that is still being played', async () => {
    const { service, repository } = setup()

    const recorded = await service.record('user-1', 26472, 'STEAM', evidence, false)

    expect(recorded).toBe(true)
    expect(repository.upsertPending).toHaveBeenCalledWith('ug-1', 'STEAM', evidence, false)
  })

  it.each([2, 3, 4])('records for a game with status %i', async statusId => {
    const { service, repository } = setup({
      findGameForRecord: vi.fn().mockResolvedValue({
        id: 'ug-1',
        statusId,
        endless: false,
        completions: 0
      })
    })

    expect(await service.record('user-1', 1, 'STEAM', evidence, false)).toBe(true)
    expect(repository.upsertPending).toHaveBeenCalled()
  })

  it.each([
    ['is already played', { statusId: 1 }],
    ['was dropped', { statusId: 6 }],
    ['is on the wishlist', { statusId: 5 }],
    ['is endless', { endless: true }],
    ['already has a completion', { completions: 1 }]
  ])('ignores a game that %s', async (_name, patch) => {
    const { service, repository } = setup({
      findGameForRecord: vi.fn().mockResolvedValue({
        id: 'ug-1',
        statusId: 3,
        endless: false,
        completions: 0,
        ...patch
      })
    })

    expect(await service.record('user-1', 1, 'STEAM', evidence, false)).toBe(false)
    expect(repository.upsertPending).not.toHaveBeenCalled()
  })

  it('ignores a game that is not in the library', async () => {
    const { service, repository } = setup({
      findGameForRecord: vi.fn().mockResolvedValue(null)
    })

    expect(await service.record('user-1', 1, 'STEAM', evidence, false)).toBe(false)
    expect(repository.upsertPending).not.toHaveBeenCalled()
  })
})

describe('CompletionSuggestionService.list', () => {
  it('lists the pending suggestions and maps the evidence', async () => {
    const { service, repository } = setup({
      listPending: vi.fn().mockResolvedValue([
        {
          igdbId: 26472,
          name: 'Disco Elysium',
          coverUrl: null,
          platform: 'STEAM',
          evidence,
          lowConfidence: false,
          createdAt: new Date('2026-10-22T12:00:00Z')
        }
      ])
    })

    const result = await service.list('user-1', 'STEAM')

    expect(repository.listPending).toHaveBeenCalledWith('user-1', 'STEAM')
    expect(result.suggestions).toEqual([
      {
        igdbId: 26472,
        name: 'Disco Elysium',
        coverUrl: null,
        platform: 'STEAM',
        hoursPlayed: 33.8,
        normallyHours: 33.1,
        achieved: 7,
        total: 45,
        lowConfidence: false,
        createdAt: '2026-10-22T12:00:00.000Z'
      }
    ])
  })
})

describe('CompletionSuggestionService.accept', () => {
  it('marks the game as played through UserService and stores the snapshot', async () => {
    const before = state()
    const after = state({
      statusId: 1,
      completions: 1,
      completedAt: '2026-10-22T12:00:00.000Z',
      platformRows: [{ id: 'row-1', completions: 1, completedAt: '2026-10-22T12:00:00.000Z' }]
    })
    const { service, repository, userService } = setup({
      readGameState: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after)
    })

    const result = await service.accept('user-1', 26472)

    expect(userService.updateGame).toHaveBeenCalledWith(26472, 'user-1', 1)
    expect(repository.markAccepted).toHaveBeenCalledWith('sug-1', { before, after })
    expect(result).toEqual({ igdbId: 26472, status: 'PLAYED', completions: 1, canUndo: true })
  })

  it('claims the suggestion before changing the game', async () => {
    const { service, repository, userService } = setup()
    const order: string[] = []
    repository.claimPending.mockImplementation(async () => {
      order.push('claim')
      return true
    })
    userService.updateGame.mockImplementation(async () => {
      order.push('update')
    })
    repository.readGameState.mockResolvedValue(state({ statusId: 3, completions: 1 }))

    await service.accept('user-1', 1)

    expect(order).toEqual(['claim', 'update'])
  })

  it('returns 409 and does not touch the game when another request claimed it first', async () => {
    const { service, userService } = setup({
      claimPending: vi.fn().mockResolvedValue(false)
    })

    await expect(service.accept('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(userService.updateGame).not.toHaveBeenCalled()
  })

  it('marks the platform of the suggestion as completed when no completion was registered', async () => {
    const { service, platformRepository } = setup({
      readGameState: vi
        .fn()
        .mockResolvedValueOnce(state())
        .mockResolvedValueOnce(state({ statusId: 1, completions: 0 }))
        .mockResolvedValueOnce(state({ statusId: 1, completions: 1 }))
    })

    const result = await service.accept('user-1', 1)

    expect(platformRepository.markSinglePlatformCompleted).toHaveBeenCalledWith(
      'ug-1',
      expect.any(Date),
      'STEAM'
    )
    expect(result.completions).toBe(1)
  })

  it('does not mark the platform when updateGame already registered a completion', async () => {
    const { service, platformRepository } = setup({
      readGameState: vi
        .fn()
        .mockResolvedValueOnce(state())
        .mockResolvedValueOnce(state({ statusId: 1, completions: 1 }))
    })

    await service.accept('user-1', 1)

    expect(platformRepository.markSinglePlatformCompleted).not.toHaveBeenCalled()
  })

  it('releases the claim when changing the game fails', async () => {
    const { service, repository, userService } = setup()
    userService.updateGame.mockRejectedValue(new Error('boom'))

    await expect(service.accept('user-1', 1)).rejects.toThrow('boom')
    expect(repository.releaseClaim).toHaveBeenCalledWith('sug-1')
    expect(repository.markAccepted).not.toHaveBeenCalled()
  })

  it('returns 404 when there is no suggestion', async () => {
    const { service } = setup({ findByUserAndIgdbId: vi.fn().mockResolvedValue(null) })

    await expect(service.accept('user-1', 1)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 409 when the suggestion was already resolved', async () => {
    const { service, userService } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue({
        id: 'sug-1',
        userGameId: 'ug-1',
        platform: 'STEAM',
        status: 'DISMISSED',
        undoSnapshot: null
      })
    })

    await expect(service.accept('user-1', 1)).rejects.toBeInstanceOf(ClientError)
    expect(userService.updateGame).not.toHaveBeenCalled()
  })

  it('returns 409 when the game is already played', async () => {
    const { service, userService } = setup({
      readGameState: vi.fn().mockResolvedValue(state({ statusId: 1 }))
    })

    await expect(service.accept('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
    expect(userService.updateGame).not.toHaveBeenCalled()
  })
})

describe('CompletionSuggestionService.dismiss', () => {
  it('dismisses a pending suggestion', async () => {
    const { service, repository } = setup()

    await service.dismiss('user-1', 1)

    expect(repository.markDismissed).toHaveBeenCalledWith('sug-1')
  })

  it('does nothing when it was already dismissed', async () => {
    const { service, repository } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue({
        id: 'sug-1',
        userGameId: 'ug-1',
        platform: 'STEAM',
        status: 'DISMISSED',
        undoSnapshot: null
      })
    })

    await service.dismiss('user-1', 1)

    expect(repository.markDismissed).not.toHaveBeenCalled()
  })

  it('returns 409 when the suggestion was accepted', async () => {
    const { service } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue({
        id: 'sug-1',
        userGameId: 'ug-1',
        platform: 'STEAM',
        status: 'ACCEPTED',
        undoSnapshot: null
      })
    })

    await expect(service.dismiss('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('CompletionSuggestionService.undo', () => {
  const before = state()
  const after = state({ statusId: 1, completions: 1 })
  const accepted = {
    id: 'sug-1',
    userGameId: 'ug-1',
    platform: 'STEAM',
    status: 'ACCEPTED',
    undoSnapshot: { before, after }
  }

  it('restores the state from before the acceptance', async () => {
    const { service, repository } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue(accepted)
    })

    const result = await service.undo('user-1', 26472)

    expect(repository.restore).toHaveBeenCalledWith(
      'sug-1',
      'ug-1',
      before,
      expect.any(Function)
    )
    const isUnchanged = repository.restore.mock.calls[0][3] as (s: GameState) => boolean
    expect(isUnchanged(after)).toBe(true)
    expect(isUnchanged({ ...after, completions: 2 })).toBe(false)
    expect(result).toEqual({ igdbId: 26472, status: 'PLAYING', completions: 0 })
  })

  it('returns 409 when the game changed after the acceptance', async () => {
    const { service } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue(accepted),
      restore: vi.fn().mockResolvedValue('changed')
    })

    await expect(service.undo('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when another undo already restored it', async () => {
    const { service } = setup({
      findByUserAndIgdbId: vi.fn().mockResolvedValue(accepted),
      restore: vi.fn().mockResolvedValue('not_accepted')
    })

    await expect(service.undo('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when there is nothing to undo', async () => {
    const { service } = setup()

    await expect(service.undo('user-1', 1)).rejects.toMatchObject({ statusCode: 409 })
  })
})
