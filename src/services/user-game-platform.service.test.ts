import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  UserGamePlatformService,
  resolveRow
} from './user-game-platform.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserRepository } from '../repositories/users.repository'
import { ClientError } from '../errors/client-error'

type Row = {
  platform: string
  console: string
  hoursPlayed: Prisma.Decimal | null
  completions: number
  completedAt: Date | null
}

function userGame(overrides: {
  statusId?: number
  completedAt?: Date | null
  hours?: number | null
  completions?: number
  endless?: boolean
  platforms?: Row[]
}) {
  return {
    id: 'ug-1',
    userGamesStatusId: overrides.statusId ?? 4,
    endless: overrides.endless ?? false,
    completedAt: overrides.completedAt ?? null,
    UserGameStats:
      overrides.hours === undefined && overrides.completions === undefined
        ? null
        : {
            hoursPlayed:
              overrides.hours != null
                ? new Prisma.Decimal(overrides.hours)
                : null,
            completions: overrides.completions ?? 0
          },
    platforms: overrides.platforms ?? []
  }
}

function row(overrides: Partial<Row> & { platform: string }): Row {
  return {
    console: 'UNKNOWN',
    hoursPlayed: null,
    completions: 0,
    completedAt: null,
    ...overrides
  }
}

function setup(found: ReturnType<typeof userGame> | null) {
  const platformRepository = {
    findUserGameWithPlatforms: vi.fn().mockResolvedValue(found),
    savePlatform: vi.fn().mockResolvedValue(undefined),
    adoptConsole: vi.fn().mockResolvedValue(undefined),
    deletePlatform: vi.fn().mockResolvedValue(undefined)
  }
  const userRepository = {
    addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
    createUserGameStats: vi.fn().mockResolvedValue(null),
    updateGameStatus: vi.fn().mockResolvedValue(null)
  }
  const service = new UserGamePlatformService(
    platformRepository as unknown as UserGamePlatformRepository,
    userRepository as unknown as UserRepository
  )
  return { service, platformRepository, userRepository }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UserGamePlatformService.addPlatform', () => {
  it('moves legacy totals into the first platform of a played game', async () => {
    const completedAt = new Date('2023-01-01T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, completedAt, hours: 40, completions: 2 })
    )

    await service.addPlatform('user-1', 10, 'STEAM', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 40, completions: 2, completedAt }
    )
  })

  it('keeps the completion history when the first platform is added to a game that is not played', async () => {
    const completedAt = new Date('2025-01-01T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({
        statusId: 3,
        completedAt,
        hours: 45,
        completions: 2
      })
    )

    await service.addPlatform('user-1', 10, 'STEAM', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 45, completions: 2, completedAt }
    )
  })

  it('does not carry a date when the game was never finished', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 4,
        completedAt: new Date(),
        hours: 5,
        completions: 0
      })
    )

    await service.addPlatform('user-1', 10, 'STEAM', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 5, completions: 0, completedAt: null }
    )
  })

  it('counts one completion on the first platform of a played game with none', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, hours: 12, completions: 0 })
    )

    await service.addPlatform('user-1', 10, 'STEAM', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 12, completions: 1, completedAt: null }
    )
  })

  it('counts one completion on additional platforms of a played game, without hours or date', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      { completions: 1 }
    )
  })

  it('starts additional platforms empty when the game is not played', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 2, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION', 'UNKNOWN')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      {}
    )
  })

  it('rejects platforms on wishlist games', async () => {
    const { service } = setup(userGame({ statusId: 5 }))

    await expect(
      service.addPlatform('user-1', 10, 'STEAM', 'UNKNOWN')
    ).rejects.toBeInstanceOf(ClientError)
  })
})

describe('UserGamePlatformService.updatePlatform', () => {
  it('rejects a completion date when the game is not played', async () => {
    const { service } = setup(
      userGame({ statusId: 3, platforms: [row({ platform: 'STEAM' })] })
    )

    await expect(
      service.updatePlatform('user-1', 10, 'STEAM', 'UNKNOWN', {
        completedAt: '2024-01-01'
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a completion date in the future', async () => {
    const { service } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await expect(
      service.updatePlatform('user-1', 10, 'STEAM', 'UNKNOWN', {
        completedAt: '2999-01-01'
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 404 for a platform the game does not have', async () => {
    const { service } = setup(userGame({ statusId: 1 }))

    await expect(
      service.updatePlatform('user-1', 10, 'XBOX', 'UNKNOWN', {
        hoursPlayed: 3
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('saves only the fields that were sent', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.updatePlatform('user-1', 10, 'STEAM', 'UNKNOWN', {
      hoursPlayed: 12.5
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 12.5 }
    )
  })
})

describe('UserGamePlatformService.importPlatform', () => {
  it('passes the endless suggestion when it creates the game', async () => {
    const { service, platformRepository, userRepository } = setup(null)
    platformRepository.findUserGameWithPlatforms
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userGame({ statusId: 3 }))

    await service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 3,
      activityStatusId: 3,
      hoursPlayed: 7,
      finished: false,
      confirmedFinished: false,
      endless: true
    })

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, endless: true })
    )
  })

  it('creates the game when it is not in the library', async () => {
    const { service, platformRepository, userRepository } = setup(null)
    platformRepository.findUserGameWithPlatforms
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userGame({ statusId: 3 }))

    const outcome = await service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 3,
      activityStatusId: 3,
      hoursPlayed: 7,
      finished: false,
      confirmedFinished: false
    })

    expect(outcome).toBe('imported')
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 3 })
    )
    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 7, completions: 0, completedAt: null }
    )
  })

  it('upgrades the status of an existing game but never downgrades it', async () => {
    const upgrade = setup(userGame({ statusId: 4 }))
    await upgrade.service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 1,
      activityStatusId: 3,
      hoursPlayed: 1,
      finished: true,
      confirmedFinished: true
    })
    expect(upgrade.userRepository.updateGameStatus).toHaveBeenCalledWith(
      10,
      'user-1',
      1
    )

    const downgrade = setup(userGame({ statusId: 1 }))
    const outcome = await downgrade.service.importPlatform(
      'user-1',
      10,
      'STEAM',
      {
        statusId: 4,
        activityStatusId: 4,
        hoursPlayed: 1,
        finished: false,
        confirmedFinished: false
      }
    )
    expect(outcome).toBe('updated')
    expect(downgrade.userRepository.updateGameStatus).not.toHaveBeenCalled()
  })

  it('brings a dropped game back to playing on recent activity and leaves it alone otherwise', async () => {
    const resumed = setup(userGame({ statusId: 6 }))
    await resumed.service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 3,
      activityStatusId: 3,
      hoursPlayed: 1,
      finished: false,
      confirmedFinished: false
    })
    expect(resumed.userRepository.updateGameStatus).toHaveBeenCalledWith(
      10,
      'user-1',
      3
    )

    const idle = setup(userGame({ statusId: 6 }))
    await idle.service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 4,
      activityStatusId: 4,
      hoursPlayed: 1,
      finished: false,
      confirmedFinished: false
    })
    expect(idle.userRepository.updateGameStatus).not.toHaveBeenCalled()
  })

  it('overwrites only its own platform hours and keeps a higher manual completion count', async () => {
    const existingDate = new Date('2021-05-10T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        platforms: [
          row({
            platform: 'STEAM',
            hoursPlayed: new Prisma.Decimal(20),
            completions: 3,
            completedAt: existingDate
          })
        ]
      })
    )

    await service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 1,
      activityStatusId: 3,
      hoursPlayed: 25,
      finished: true,
      confirmedFinished: true,
      completedAt: new Date('2024-01-01T00:00:00Z')
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledTimes(1)
    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'UNKNOWN',
      { hoursPlayed: 25, completions: 3, completedAt: existingDate }
    )
  })

  it('replaces legacy manual hours but keeps legacy completion data on the first platform', async () => {
    const legacyDate = new Date('2020-02-02T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        completedAt: legacyDate,
        hours: 40,
        completions: 2
      })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', {
      statusId: 4,
      activityStatusId: 4,
      hoursPlayed: 30,
      finished: false,
      confirmedFinished: false
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      { hoursPlayed: 30, completions: 2, completedAt: legacyDate }
    )
  })

  it('sets one completion and the imported date when a new platform was finished', async () => {
    const importedDate = new Date('2024-03-01T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', {
      statusId: 1,
      activityStatusId: 3,
      hoursPlayed: 30,
      finished: true,
      confirmedFinished: true,
      completedAt: importedDate
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      { hoursPlayed: 30, completions: 1, completedAt: importedDate }
    )
  })

  describe('endless games', () => {
    const finishedSignals = {
      statusId: 1,
      activityStatusId: 3,
      hoursPlayed: 3000,
      finished: true,
      confirmedFinished: true,
      strongFinished: true,
      completedAt: new Date('2024-03-01T00:00:00Z')
    }

    it('creates a new endless game with the activity status and no completion, ignoring finished signals', async () => {
      const { service, platformRepository, userRepository } = setup(null)
      platformRepository.findUserGameWithPlatforms
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(userGame({ statusId: 3 }))

      await service.importPlatform('user-1', 10, 'STEAM', {
        ...finishedSignals,
        endless: true
      })

      expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
        igdbId: 10,
        userId: 'user-1',
        statusIds: 3,
        completedAt: undefined,
        endless: true
      })
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'STEAM',
        'UNKNOWN',
        { hoursPlayed: 3000, completions: 0, completedAt: null }
      )
    })

    it.each([
      ['has many hours but was not opened recently', 3000, 4],
      ['has no hours', 0, 4],
      ['was opened recently', 3000, 3]
    ])(
      'gives a new endless game the activity status when it %s',
      async (_label, hours, activityStatusId) => {
        const { service, platformRepository, userRepository } = setup(null)
        platformRepository.findUserGameWithPlatforms
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(userGame({ statusId: activityStatusId }))

        await service.importPlatform('user-1', 10, 'STEAM', {
          ...finishedSignals,
          hoursPlayed: hours,
          activityStatusId,
          endless: true
        })

        expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
          expect.objectContaining({ statusIds: activityStatusId })
        )
      }
    )

    it('does not promote an existing endless game to PLAYED or count a completion', async () => {
      const { service, platformRepository, userRepository } = setup(
        userGame({
          statusId: 2,
          endless: true,
          platforms: [row({ platform: 'STEAM' })]
        })
      )

      await service.importPlatform('user-1', 10, 'STEAM', finishedSignals)

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        3
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'STEAM',
        'UNKNOWN',
        { hoursPlayed: 3000, completions: 0, completedAt: null }
      )
    })

    it('still trusts the signals for an existing game whose endless mark is off', async () => {
      const { service, userRepository } = setup(
        userGame({
          statusId: 4,
          endless: false,
          platforms: [row({ platform: 'STEAM' })]
        })
      )

      await service.importPlatform('user-1', 10, 'STEAM', {
        ...finishedSignals,
        endless: true
      })

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        1
      )
    })
  })

  describe('rule for games already in the library', () => {
    const heuristicOnly = {
      statusId: 1,
      activityStatusId: 3,
      hoursPlayed: 12,
      finished: true,
      confirmedFinished: false,
      completedAt: new Date('2024-03-01T00:00:00Z')
    }

    it('does not mark an existing game as played on the heuristic alone', async () => {
      const { service, platformRepository, userRepository } = setup(
        userGame({ statusId: 2, platforms: [row({ platform: 'STEAM' })] })
      )

      await service.importPlatform('user-1', 10, 'STEAM', heuristicOnly)

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        3
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'STEAM',
        'UNKNOWN',
        { hoursPlayed: 12, completions: 0, completedAt: null }
      )
    })

    it('marks an existing game as played, with a completion, when it is confirmed', async () => {
      const { service, platformRepository, userRepository } = setup(
        userGame({ statusId: 4, platforms: [row({ platform: 'STEAM' })] })
      )

      await service.importPlatform('user-1', 10, 'STEAM', {
        ...heuristicOnly,
        confirmedFinished: true
      })

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        1
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'STEAM',
        'UNKNOWN',
        {
          hoursPlayed: 12,
          completions: 1,
          completedAt: heuristicOnly.completedAt
        }
      )
    })

    it('still moves an owned wishlist game up by recent activity', async () => {
      const { service, userRepository } = setup(
        userGame({ statusId: 5, platforms: [] })
      )

      await service.importPlatform('user-1', 10, 'STEAM', {
        ...heuristicOnly,
        finished: false
      })

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        3
      )
    })

    it('marks a backlog game as played, with a completion, on the heuristic', async () => {
      const { service, platformRepository, userRepository } = setup(
        userGame({ statusId: 4, platforms: [row({ platform: 'STEAM' })] })
      )

      await service.importPlatform('user-1', 10, 'XBOX', heuristicOnly)

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        1
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'XBOX',
        'UNKNOWN',
        {
          hoursPlayed: 12,
          completions: 1,
          completedAt: heuristicOnly.completedAt
        }
      )
    })

    describe('a game in progress', () => {
      const strong = { ...heuristicOnly, strongFinished: true }

      it('is marked as played, with a completion, on a strong finishing signal when it has no completion yet', async () => {
        const { service, platformRepository, userRepository } = setup(
          userGame({ statusId: 3, platforms: [row({ platform: 'STEAM' })] })
        )

        await service.importPlatform('user-1', 10, 'STEAM', strong)

        expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
          10,
          'user-1',
          1
        )
        expect(platformRepository.savePlatform).toHaveBeenCalledWith(
          'ug-1',
          'STEAM',
          'UNKNOWN',
          {
            hoursPlayed: 12,
            completions: 1,
            completedAt: heuristicOnly.completedAt
          }
        )
      })

      it('stays as it is when a completion is already registered', async () => {
        const { service, userRepository } = setup(
          userGame({
            statusId: 3,
            platforms: [row({ platform: 'STEAM', completions: 1 })]
          })
        )

        await service.importPlatform('user-1', 10, 'STEAM', strong)

        expect(userRepository.updateGameStatus).not.toHaveBeenCalled()
      })

      it('stays as it is when the signal is not strong', async () => {
        const { service, userRepository } = setup(
          userGame({ statusId: 3, platforms: [row({ platform: 'STEAM' })] })
        )

        await service.importPlatform('user-1', 10, 'STEAM', heuristicOnly)

        expect(userRepository.updateGameStatus).not.toHaveBeenCalled()
      })

      it.each([
        ['paused', 2],
        ['dropped', 6]
      ])(
        'does not move a %s game on a strong signal',
        async (_label, statusId) => {
          const { service, userRepository } = setup(
            userGame({ statusId, platforms: [row({ platform: 'STEAM' })] })
          )

          await service.importPlatform('user-1', 10, 'STEAM', strong)

          expect(userRepository.updateGameStatus).not.toHaveBeenCalledWith(
            10,
            'user-1',
            1
          )
        }
      )
    })

    it('leaves a game in progress alone on the heuristic', async () => {
      const { service, userRepository } = setup(
        userGame({ statusId: 3, platforms: [row({ platform: 'STEAM' })] })
      )

      await service.importPlatform('user-1', 10, 'XBOX', heuristicOnly)

      expect(userRepository.updateGameStatus).not.toHaveBeenCalled()
    })

    it('marks a wishlist game as played, with a completion, on the heuristic', async () => {
      const { service, platformRepository, userRepository } = setup(
        userGame({ statusId: 5, platforms: [] })
      )

      await service.importPlatform('user-1', 10, 'XBOX', heuristicOnly)

      expect(userRepository.updateGameStatus).toHaveBeenCalledWith(
        10,
        'user-1',
        1
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'XBOX',
        'UNKNOWN',
        {
          hoursPlayed: 12,
          completions: 1,
          completedAt: heuristicOnly.completedAt
        }
      )
    })

    it('leaves a played game as it is when the import is not confirmed', async () => {
      const { service, userRepository } = setup(
        userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
      )

      await service.importPlatform('user-1', 10, 'STEAM', heuristicOnly)

      expect(userRepository.updateGameStatus).not.toHaveBeenCalled()
    })

    it('keeps the heuristic for a game that is new to the library', async () => {
      const { service, platformRepository, userRepository } = setup(null)
      platformRepository.findUserGameWithPlatforms
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(userGame({ statusId: 1 }))

      await service.importPlatform('user-1', 10, 'STEAM', heuristicOnly)

      expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ igdbId: 10, statusIds: 1 })
      )
      expect(platformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-1',
        'STEAM',
        'UNKNOWN',
        {
          hoursPlayed: 12,
          completions: 1,
          completedAt: heuristicOnly.completedAt
        }
      )
    })
  })
})

describe('console per platform', () => {
  const imported = {
    statusId: 3,
    activityStatusId: 3,
    hoursPlayed: 5,
    finished: false,
    confirmedFinished: false
  }

  describe('resolveRow', () => {
    const rows = (...entries: [string, string][]) =>
      entries.map(([platform, console]) => row({ platform, console })) as never

    it('uses the row with the exact platform and console', () => {
      const found = resolveRow(
        rows(['XBOX', 'XBOX_360'], ['XBOX', 'XBOX_ONE']),
        'XBOX',
        'XBOX_ONE'
      )
      expect(found).toMatchObject({
        action: 'update',
        row: { console: 'XBOX_ONE' }
      })
    })

    it('updates the only row of the platform when the import has no console', () => {
      const found = resolveRow(rows(['XBOX', 'XBOX_360']), 'XBOX', 'UNKNOWN')
      expect(found).toMatchObject({
        action: 'update',
        row: { console: 'XBOX_360' }
      })
    })

    it('skips an UNKNOWN import when the platform has several known-console rows', () => {
      const found = resolveRow(
        rows(['XBOX', 'XBOX_360'], ['XBOX', 'XBOX_ONE']),
        'XBOX',
        'UNKNOWN'
      )
      expect(found).toEqual({ action: 'skip' })
    })

    it('ignores rows of other platforms', () => {
      const found = resolveRow(rows(['STEAM', 'PC']), 'XBOX', 'UNKNOWN')
      expect(found).toEqual({ action: 'create' })
    })

    it('adopts the UNKNOWN row when a known console arrives', () => {
      const found = resolveRow(
        rows(['PLAYSTATION', 'UNKNOWN'], ['PLAYSTATION', 'PS5']),
        'PLAYSTATION',
        'PS4'
      )
      expect(found).toMatchObject({
        action: 'adopt',
        row: { console: 'UNKNOWN' }
      })
    })

    it('creates a row when a known console arrives and there is no UNKNOWN row', () => {
      const found = resolveRow(
        rows(['PLAYSTATION', 'PS5']),
        'PLAYSTATION',
        'PS4'
      )
      expect(found).toEqual({ action: 'create' })
    })
  })

  it('adds a second console of the same platform', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 2,
        platforms: [row({ platform: 'XBOX', console: 'XBOX_360' })]
      })
    )

    await service.addPlatform('user-1', 10, 'XBOX', 'XBOX_ONE')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'XBOX',
      'XBOX_ONE',
      {}
    )
  })

  it('does not add a console that the game already has', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 2,
        platforms: [row({ platform: 'XBOX', console: 'XBOX_360' })]
      })
    )

    await service.addPlatform('user-1', 10, 'XBOX', 'XBOX_360')

    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
  })

  it.each([
    [
      'add',
      (s: ReturnType<typeof setup>['service']) =>
        s.addPlatform('user-1', 10, 'XBOX', 'PS5')
    ],
    [
      'update',
      (s: ReturnType<typeof setup>['service']) =>
        s.updatePlatform('user-1', 10, 'XBOX', 'PS5', { hoursPlayed: 1 })
    ],
    [
      'remove',
      (s: ReturnType<typeof setup>['service']) =>
        s.removePlatform('user-1', 10, 'XBOX', 'PS5')
    ],
    [
      'import',
      (s: ReturnType<typeof setup>['service']) =>
        s.importPlatform('user-1', 10, 'XBOX', imported, 'PS5')
    ]
  ])(
    'rejects a console that does not belong to the platform on %s',
    async (_name, call) => {
      const { service, platformRepository } = setup(userGame({ statusId: 2 }))

      await expect(call(service)).rejects.toMatchObject({ statusCode: 400 })
      expect(platformRepository.savePlatform).not.toHaveBeenCalled()
    }
  )

  it('removes only the row of the given console', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 2,
        platforms: [
          row({ platform: 'XBOX', console: 'XBOX_360' }),
          row({ platform: 'XBOX', console: 'XBOX_ONE' })
        ]
      })
    )

    await service.removePlatform('user-1', 10, 'XBOX', 'XBOX_ONE')

    expect(platformRepository.deletePlatform).toHaveBeenCalledWith(
      'ug-1',
      'XBOX',
      'XBOX_ONE'
    )
  })

  it('import without console updates the only console row instead of creating UNKNOWN', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 3,
        platforms: [row({ platform: 'XBOX', console: 'XBOX_360' })]
      })
    )

    await service.importPlatform('user-1', 10, 'XBOX', imported)

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'XBOX',
      'XBOX_360',
      expect.objectContaining({ hoursPlayed: 5 })
    )
    expect(platformRepository.adoptConsole).not.toHaveBeenCalled()
  })

  it('import without console writes nothing when the platform has several consoles', async () => {
    const { service, platformRepository, userRepository } = setup(
      userGame({
        statusId: 3,
        platforms: [
          row({ platform: 'XBOX', console: 'XBOX_360' }),
          row({ platform: 'XBOX', console: 'XBOX_ONE' })
        ]
      })
    )

    const outcome = await service.importPlatform('user-1', 10, 'XBOX', imported)

    expect(outcome).toBe('skipped')
    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
    expect(platformRepository.adoptConsole).not.toHaveBeenCalled()
    expect(userRepository.addGameToUserLibrary).not.toHaveBeenCalled()
  })

  it('import with a known console adopts the UNKNOWN row and keeps its completions', async () => {
    const completedAt = new Date('2022-02-02T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        platforms: [
          row({ platform: 'PLAYSTATION', completions: 2, completedAt })
        ]
      })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', imported, 'PS4')

    expect(platformRepository.adoptConsole).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      'PS4',
      { hoursPlayed: 5, completions: 2, completedAt }
    )
    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
  })

  it('starts a second console of the same platform with one completion on a played game', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        platforms: [
          row({ platform: 'XBOX', console: 'XBOX_360', completions: 1 })
        ]
      })
    )

    await service.addPlatform('user-1', 10, 'XBOX', 'XBOX_ONE')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'XBOX',
      'XBOX_ONE',
      { completions: 1 }
    )
  })

  it('still counts one completion on a played game when the platform has no row yet', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        platforms: [
          row({ platform: 'XBOX', console: 'XBOX_360', completions: 1 })
        ]
      })
    )

    await service.addPlatform('user-1', 10, 'STEAM', 'PC')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      'PC',
      { completions: 1 }
    )
  })

  it('adding a known console adopts the only row of the platform when it is UNKNOWN', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 1,
        platforms: [
          row({
            platform: 'PLAYSTATION',
            completions: 1,
            hoursPlayed: new Prisma.Decimal(40)
          })
        ]
      })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION', 'PS5')

    expect(platformRepository.adoptConsole).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      'PS5',
      {}
    )
    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
  })

  it('adding a known console adopts the UNKNOWN row even when the platform has other consoles', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 2,
        platforms: [
          row({ platform: 'PLAYSTATION' }),
          row({ platform: 'PLAYSTATION', console: 'PS5' })
        ]
      })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION', 'PS4')

    expect(platformRepository.adoptConsole).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      'PS4',
      {}
    )
    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
  })

  it.each([
    ['one known console', [row({ platform: 'PLAYSTATION', console: 'PS4' })]],
    [
      'several known consoles',
      [
        row({ platform: 'PLAYSTATION', console: 'PS4' }),
        row({ platform: 'PLAYSTATION', console: 'PS5' })
      ]
    ]
  ])(
    'adding UNKNOWN next to %s is rejected instead of doing nothing',
    async (_name, platforms) => {
      const { service, platformRepository } = setup(
        userGame({ statusId: 2, platforms })
      )

      await expect(
        service.addPlatform('user-1', 10, 'PLAYSTATION', 'UNKNOWN')
      ).rejects.toMatchObject({ statusCode: 400 })
      expect(platformRepository.savePlatform).not.toHaveBeenCalled()
      expect(platformRepository.adoptConsole).not.toHaveBeenCalled()
    }
  )

  it('import skips before changing the status when the platform has several known consoles', async () => {
    const { service, platformRepository, userRepository } = setup(
      userGame({
        statusId: 4,
        platforms: [
          row({ platform: 'PLAYSTATION', console: 'PS4' }),
          row({ platform: 'PLAYSTATION', console: 'PS5' })
        ]
      })
    )

    const outcome = await service.importPlatform('user-1', 10, 'PLAYSTATION', {
      ...imported,
      statusId: 1,
      finished: true,
      confirmedFinished: true
    })

    expect(outcome).toBe('skipped')
    expect(userRepository.updateGameStatus).not.toHaveBeenCalled()
    expect(platformRepository.savePlatform).not.toHaveBeenCalled()
  })
})

describe('resolveRow for an import with a known console', () => {
  const rows = (...consoles: string[]) =>
    consoles.map(c => row({ platform: 'PLAYSTATION', console: c })) as never
  const resolve = (existing: string[], fromImport = true) =>
    resolveRow(rows(...existing), 'PLAYSTATION', 'PS4', { fromImport })

  it('updates the exact row', () => {
    expect(resolve(['PS4', 'PS5'])).toMatchObject({
      action: 'update',
      row: { console: 'PS4' }
    })
  })

  it('adopts the UNKNOWN row, even next to other known rows', () => {
    expect(resolve(['UNKNOWN'])).toMatchObject({ action: 'adopt' })
    expect(resolve(['UNKNOWN', 'PS5'])).toMatchObject({
      action: 'adopt',
      row: { console: 'UNKNOWN' }
    })
  })

  it('updates the only other known row and keeps its console', () => {
    expect(resolve(['PS5'])).toMatchObject({
      action: 'update',
      row: { console: 'PS5' }
    })
  })

  it('creates the row when the platform has none or two other known rows', () => {
    expect(resolve([])).toEqual({ action: 'create' })
    expect(resolve(['PS3', 'PS5'])).toEqual({ action: 'create' })
  })

  it('ignores rows of another platform', () => {
    expect(
      resolveRow(
        [row({ platform: 'XBOX', console: 'XBOX_ONE' })] as never,
        'PLAYSTATION',
        'PS4',
        {
          fromImport: true
        }
      )
    ).toEqual({ action: 'create' })
  })

  it('still creates when the same input comes from a manual add', () => {
    expect(resolve(['PS5'], false)).toEqual({ action: 'create' })
  })
})

describe('importPlatform with an inferred console', () => {
  const imported = {
    statusId: 3,
    activityStatusId: 3,
    hoursPlayed: 5,
    finished: false,
    confirmedFinished: false
  }

  it('fills the console of an UNKNOWN row and keeps its completions', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 3,
        platforms: [row({ platform: 'PLAYSTATION', completions: 2 })]
      })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', imported, 'PS5')

    expect(platformRepository.adoptConsole).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'UNKNOWN',
      'PS5',
      expect.objectContaining({ hoursPlayed: 5, completions: 2 })
    )
  })

  it('writes the hours into the only other known row and keeps its console', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 3,
        platforms: [row({ platform: 'PLAYSTATION', console: 'PS5' })]
      })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', imported, 'PS4')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'PS5',
      expect.objectContaining({ hoursPlayed: 5 })
    )
    expect(platformRepository.adoptConsole).not.toHaveBeenCalled()
  })

  it('creates the row of the console when two other known rows exist', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 3,
        platforms: [
          row({ platform: 'PLAYSTATION', console: 'PS3' }),
          row({ platform: 'PLAYSTATION', console: 'PS5' })
        ]
      })
    )

    const outcome = await service.importPlatform(
      'user-1',
      10,
      'PLAYSTATION',
      imported,
      'PS4'
    )

    expect(outcome).toBe('updated')
    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'PS4',
      expect.objectContaining({ hoursPlayed: 5 })
    )
  })

  it('a manual add of a second console still creates a row', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 2,
        platforms: [row({ platform: 'PLAYSTATION', console: 'PS5' })]
      })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION', 'PS4')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      'PS4',
      {}
    )
  })
})
