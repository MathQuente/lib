import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { UserGamePlatformService } from './user-game-platform.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserRepository } from '../repositories/users.repository'
import { ClientError } from '../errors/client-error'

type Row = {
  platform: string
  hoursPlayed: Prisma.Decimal | null
  completions: number
  completedAt: Date | null
}

function userGame(overrides: {
  statusId?: number
  completedAt?: Date | null
  hours?: number | null
  completions?: number
  platforms?: Row[]
}) {
  return {
    id: 'ug-1',
    userGamesStatusId: overrides.statusId ?? 4,
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

    await service.addPlatform('user-1', 10, 'STEAM')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 40, completions: 2, completedAt }
    )
  })

  it('does not inherit completions or date when the game is not played', async () => {
    const { service, platformRepository } = setup(
      userGame({
        statusId: 4,
        completedAt: new Date(),
        hours: 5,
        completions: 1
      })
    )

    await service.addPlatform('user-1', 10, 'STEAM')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 5, completions: 0, completedAt: null }
    )
  })

  it('counts one completion on the first platform of a played game with none', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, hours: 12, completions: 0 })
    )

    await service.addPlatform('user-1', 10, 'STEAM')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 12, completions: 1, completedAt: null }
    )
  })

  it('counts one completion on additional platforms of a played game, without hours or date', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      { completions: 1 }
    )
  })

  it('starts additional platforms empty when the game is not played', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 2, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.addPlatform('user-1', 10, 'PLAYSTATION')

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      {}
    )
  })

  it('rejects platforms on wishlist games', async () => {
    const { service } = setup(userGame({ statusId: 5 }))

    await expect(
      service.addPlatform('user-1', 10, 'STEAM')
    ).rejects.toBeInstanceOf(ClientError)
  })
})

describe('UserGamePlatformService.updatePlatform', () => {
  it('rejects a completion date when the game is not played', async () => {
    const { service } = setup(
      userGame({ statusId: 3, platforms: [row({ platform: 'STEAM' })] })
    )

    await expect(
      service.updatePlatform('user-1', 10, 'STEAM', {
        completedAt: '2024-01-01'
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a completion date in the future', async () => {
    const { service } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await expect(
      service.updatePlatform('user-1', 10, 'STEAM', {
        completedAt: '2999-01-01'
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 404 for a platform the game does not have', async () => {
    const { service } = setup(userGame({ statusId: 1 }))

    await expect(
      service.updatePlatform('user-1', 10, 'XBOX', { hoursPlayed: 3 })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('saves only the fields that were sent', async () => {
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, platforms: [row({ platform: 'STEAM' })] })
    )

    await service.updatePlatform('user-1', 10, 'STEAM', { hoursPlayed: 12.5 })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 12.5 }
    )
  })
})

describe('UserGamePlatformService.importPlatform', () => {
  it('creates the game when it is not in the library', async () => {
    const { service, platformRepository, userRepository } = setup(null)
    platformRepository.findUserGameWithPlatforms
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userGame({ statusId: 3 }))

    const outcome = await service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 3,
      hoursPlayed: 7,
      finished: false
    })

    expect(outcome).toBe('imported')
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 3 })
    )
    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 7, completions: 0, completedAt: null }
    )
  })

  it('upgrades the status of an existing game but never downgrades it', async () => {
    const upgrade = setup(userGame({ statusId: 4 }))
    await upgrade.service.importPlatform('user-1', 10, 'STEAM', {
      statusId: 1,
      hoursPlayed: 1,
      finished: true
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
      { statusId: 4, hoursPlayed: 1, finished: false }
    )
    expect(outcome).toBe('updated')
    expect(downgrade.userRepository.updateGameStatus).not.toHaveBeenCalled()
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
      hoursPlayed: 25,
      finished: true,
      completedAt: new Date('2024-01-01T00:00:00Z')
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledTimes(1)
    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'STEAM',
      { hoursPlayed: 25, completions: 3, completedAt: existingDate }
    )
  })

  it('replaces legacy manual hours but keeps legacy completion data on the first platform', async () => {
    const legacyDate = new Date('2020-02-02T00:00:00Z')
    const { service, platformRepository } = setup(
      userGame({ statusId: 1, completedAt: legacyDate, hours: 40, completions: 2 })
    )

    await service.importPlatform('user-1', 10, 'PLAYSTATION', {
      statusId: 4,
      hoursPlayed: 30,
      finished: false
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
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
      hoursPlayed: 30,
      finished: true,
      completedAt: importedDate
    })

    expect(platformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-1',
      'PLAYSTATION',
      { hoursPlayed: 30, completions: 1, completedAt: importedDate }
    )
  })
})
