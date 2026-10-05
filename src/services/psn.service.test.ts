import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PsnService } from './psn.service'
import {
  PsnApiError,
  PsnApiService,
  PsnPlayedGame,
  PsnTrophySummary
} from './psn-api.service'
import { IGDBService } from './igdb.service'
import { UserRepository } from '../repositories/users.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { GameCacheService } from './game-cache.service'
import { ClientError } from '../errors/client-error'
import { IGDBGame } from '../types/igdb'
import {
  fakePlatformService,
  FakePlatformRepository
} from '../test-utils/fake-platform-service'

const DAY_MS = 24 * 60 * 60 * 1000

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return {
    findUserById: vi
      .fn()
      .mockResolvedValue({ id: 'user-1', psnAccountId: 'acc-1' }),
    findUserGame: vi.fn().mockResolvedValue(null),
    addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
    createUserGameStats: vi.fn().mockResolvedValue(null),
    upsertUserGameHours: vi.fn().mockResolvedValue(null),
    setPsnAccount: vi.fn().mockResolvedValue(null),
    ...overrides
  } as unknown as UserRepository
}

function fakeGameCacheService(): GameCacheService {
  return {
    cacheMany: vi.fn().mockResolvedValue(undefined)
  } as unknown as GameCacheService
}

function fakePsnApi(overrides: Partial<PsnApiService> = {}): PsnApiService {
  return {
    findProfile: vi.fn(),
    getPlayedGames: vi.fn().mockResolvedValue([]),
    getTrophySummariesByName: vi.fn().mockResolvedValue(new Map()),
    getTrophySummariesByTitleId: vi.fn().mockResolvedValue(new Map()),
    getEarnedTrophies: vi.fn().mockResolvedValue([]),
    ...overrides
  } as unknown as PsnApiService
}

function summary(overrides: Partial<PsnTrophySummary> = {}): PsnTrophySummary {
  return {
    progress: 0,
    hasPlatinum: false,
    lastTrophyAt: null,
    earned: 0,
    total: 0,
    npCommunicationId: 'NPWR00001_00',
    npServiceName: 'trophy',
    ...overrides
  }
}

function played(overrides: Partial<PsnPlayedGame>): PsnPlayedGame {
  return {
    titleId: 'CUSA00001_00',
    conceptId: '100',
    name: 'Game',
    playMinutes: 60,
    lastPlayedAt: new Date(Date.now() - 365 * DAY_MS),
    ...overrides
  }
}

function igdb(id: number, name = `Game ${id}`): IGDBGame {
  return { id, name } as IGDBGame
}

function mockIgdb(pairs: [string, number][]) {
  return vi
    .spyOn(IGDBService, 'getGamesByExternalIds')
    .mockResolvedValue(pairs.map(([uid, id]) => ({ uid, game: igdb(id) })))
}

let lastPlatformRepository: FakePlatformRepository

function fakeCacheRepository(stored: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(stored),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined)
  } as unknown as CacheRepository & {
    get: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    del: ReturnType<typeof vi.fn>
  }
}

function makeService(
  userRepository: UserRepository,
  psnApi: PsnApiService,
  cacheRepository: CacheRepository = fakeCacheRepository()
): PsnService {
  const fake = fakePlatformService(userRepository)
  lastPlatformRepository = fake.platformRepository
  return new PsnService(
    userRepository,
    fakeGameCacheService(),
    psnApi,
    fake.service,
    cacheRepository
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PsnService.startPsnVerification', () => {
  it('stores a one-time code for the looked-up profile', async () => {
    const cache = fakeCacheRepository()
    const psnApi = fakePsnApi({
      findProfile: vi
        .fn()
        .mockResolvedValue({ accountId: '999', onlineId: 'Player_1', aboutMe: '' })
    })
    const service = makeService(fakeUserRepository(), psnApi, cache)

    const result = await service.startPsnVerification('user-1', ' player_1 ')

    expect(psnApi.findProfile).toHaveBeenCalledWith('player_1')
    expect(result.psnOnlineId).toBe('Player_1')
    expect(result.code).toMatch(/^LIB-[0-9A-F]{8}$/)
    expect(cache.set).toHaveBeenCalledWith(
      'psn-verification:user-1',
      { accountId: '999', onlineId: 'Player_1', code: result.code },
      expect.any(Number)
    )
  })

  it('throws 400 when the PSN profile does not exist', async () => {
    const service = makeService(
      fakeUserRepository(),
      fakePsnApi({ findProfile: vi.fn().mockResolvedValue(null) })
    )

    await expect(
      service.startPsnVerification('user-1', 'ghost')
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 502 when PSN lookup fails', async () => {
    const service = makeService(
      fakeUserRepository(),
      fakePsnApi({
        findProfile: vi.fn().mockRejectedValue(new PsnApiError('boom'))
      })
    )

    await expect(
      service.startPsnVerification('user-1', 'someone')
    ).rejects.toMatchObject({ statusCode: 502 })
  })
})

describe('PsnService.connectPsn', () => {
  const pending = { accountId: '999', onlineId: 'Player_1', code: 'LIB-ABCD1234' }

  it('links the account when the code is in the profile "About me"', async () => {
    const setPsnAccount = vi.fn().mockResolvedValue(null)
    const cache = fakeCacheRepository(pending)
    const service = makeService(
      fakeUserRepository({ setPsnAccount }),
      fakePsnApi({
        findProfile: vi.fn().mockResolvedValue({
          accountId: '999',
          onlineId: 'Player_1',
          aboutMe: 'hi LIB-ABCD1234'
        })
      }),
      cache
    )

    const result = await service.connectPsn('user-1')

    expect(setPsnAccount).toHaveBeenCalledWith('user-1', {
      accountId: '999',
      onlineId: 'Player_1'
    })
    expect(cache.del).toHaveBeenCalledWith('psn-verification:user-1')
    expect(result).toEqual({ psnOnlineId: 'Player_1' })
  })

  it('throws 400 and does not link when the code is missing', async () => {
    const setPsnAccount = vi.fn()
    const service = makeService(
      fakeUserRepository({ setPsnAccount }),
      fakePsnApi({
        findProfile: vi.fn().mockResolvedValue({
          accountId: '999',
          onlineId: 'Player_1',
          aboutMe: 'nothing here'
        })
      }),
      fakeCacheRepository(pending)
    )

    await expect(service.connectPsn('user-1')).rejects.toMatchObject({
      statusCode: 400
    })
    expect(setPsnAccount).not.toHaveBeenCalled()
  })

  it('throws 400 and does not link when the online id now belongs to another account', async () => {
    const setPsnAccount = vi.fn()
    const service = makeService(
      fakeUserRepository({ setPsnAccount }),
      fakePsnApi({
        findProfile: vi.fn().mockResolvedValue({
          accountId: '111',
          onlineId: 'Player_1',
          aboutMe: 'LIB-ABCD1234'
        })
      }),
      fakeCacheRepository(pending)
    )

    await expect(service.connectPsn('user-1')).rejects.toMatchObject({
      statusCode: 400
    })
    expect(setPsnAccount).not.toHaveBeenCalled()
  })

  it('throws 400 when no verification was started', async () => {
    const psnApi = fakePsnApi()
    const service = makeService(fakeUserRepository(), psnApi)

    await expect(service.connectPsn('user-1')).rejects.toMatchObject({
      statusCode: 400
    })
    expect(psnApi.findProfile).not.toHaveBeenCalled()
  })

  it('throws 409 when the PSN account is linked to another user', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test'
    })
    const service = makeService(
      fakeUserRepository({
        setPsnAccount: vi.fn().mockRejectedValue(duplicate)
      }),
      fakePsnApi({
        findProfile: vi.fn().mockResolvedValue({
          accountId: '999',
          onlineId: 'Player_1',
          aboutMe: 'LIB-ABCD1234'
        })
      }),
      fakeCacheRepository(pending)
    )

    await expect(service.connectPsn('user-1')).rejects.toMatchObject({
      statusCode: 409
    })
  })
})

describe('PsnService.enqueueImport', () => {
  it('throws when the user has not connected PSN yet', async () => {
    const service = makeService(
      fakeUserRepository({
        findUserById: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', psnAccountId: null })
      }),
      fakePsnApi()
    )

    await expect(service.enqueueImport('user-1')).rejects.toThrow(ClientError)
  })
})

describe('PsnService.runImport', () => {
  it('merges PS4 and PS5 entries of the same concept and sums playtime', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 10 })
    mockIgdb([['100', 10]])
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue([
          played({ titleId: 'CUSA1_00', playMinutes: 90 }),
          played({ titleId: 'PPSA1_00', playMinutes: 30 })
        ])
      })
    )

    const result = await service.runImport('user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledTimes(1)
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledTimes(1)
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'PLAYSTATION',
      expect.objectContaining({ hoursPlayed: 2 })
    )
    expect(result.library).toEqual({
      imported: 1,
      updated: 0,
      skipped: 0,
      notFound: []
    })
  })

  it('marks platinum games as played, using the last trophy date as completedAt', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 10 })
    const lastTrophyAt = new Date('2025-03-01T10:00:00Z')
    mockIgdb([['100', 10]])
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      fakePsnApi({
        getPlayedGames: vi
          .fn()
          .mockResolvedValue([played({ name: 'Bloodborne™' })]),
        getTrophySummariesByName: vi.fn().mockResolvedValue(
          new Map<string, PsnTrophySummary>([
            ['bloodborne', summary({ progress: 100, hasPlatinum: true, lastTrophyAt })]
          ])
        )
      })
    )

    await service.runImport('user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 10,
      userId: 'user-1',
      statusIds: 1,
      completedAt: lastTrophyAt
    })
  })

  it('marks recently played unfinished games as playing and old ones as backlog', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 1 })
    mockIgdb([
      ['100', 10],
      ['200', 20]
    ])
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue([
          played({
            conceptId: '100',
            name: 'Recent',
            lastPlayedAt: new Date(Date.now() - 2 * DAY_MS)
          }),
          played({ conceptId: '200', titleId: 'CUSA2_00', name: 'Old' })
        ])
      })
    )

    await service.runImport('user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 3 })
    )
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 20, statusIds: 4 })
    )
  })

  it('falls back to the title id lookup when the trophy name does not match', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 10 })
    const getTrophySummariesByTitleId = vi.fn().mockResolvedValue(
      new Map<string, PsnTrophySummary>([
        [
          'CUSA9_00',
          summary({ progress: 100, lastTrophyAt: new Date() })
        ]
      ])
    )
    mockIgdb([['100', 10]])
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      fakePsnApi({
        getPlayedGames: vi
          .fn()
          .mockResolvedValue([
            played({ titleId: 'CUSA9_00', name: 'Kena: Bridge of Spirits PS4 & PS5' })
          ]),
        getTrophySummariesByTitleId
      })
    )

    await service.runImport('user-1')

    expect(getTrophySummariesByTitleId).toHaveBeenCalledWith('acc-1', ['CUSA9_00'])
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 1 })
    )
  })

  it('still imports games when the trophy lookup fails', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 10 })
    mockIgdb([['100', 10]])
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue([played({})]),
        getTrophySummariesByName: vi
          .fn()
          .mockRejectedValue(new PsnApiError('private trophies'))
      })
    )

    const result = await service.runImport('user-1')

    expect(result.library.imported).toBe(1)
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 4 })
    )
  })

  it('reports unmatched and concept-less games as not found and updates owned ones', async () => {
    mockIgdb([['100', 10]])
    const updateGameStatus = vi.fn().mockResolvedValue(null)
    const service = makeService(
      fakeUserRepository({
        findUserGame: vi
          .fn()
          .mockResolvedValue({ id: 'existing', UserGamesStatus: { id: 5 } }),
        updateGameStatus
      }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue([
          played({ conceptId: '100', name: 'Owned' }),
          played({ conceptId: '300', titleId: 'CUSA3_00', name: 'Unknown to IGDB' }),
          played({ conceptId: null, titleId: 'CUSA4_00', name: 'No concept' })
        ])
      })
    )

    const result = await service.runImport('user-1')

    expect(result.library).toEqual({
      imported: 0,
      updated: 1,
      skipped: 0,
      notFound: ['No concept', 'Unknown to IGDB']
    })
    expect(updateGameStatus).toHaveBeenCalledWith(10, 'user-1', 4)
  })

  it('never downgrades the status of a game already in the library', async () => {
    mockIgdb([['100', 10]])
    const updateGameStatus = vi.fn().mockResolvedValue(null)
    const service = makeService(
      fakeUserRepository({
        findUserGame: vi
          .fn()
          .mockResolvedValue({ id: 'existing', UserGamesStatus: { id: 1 } }),
        updateGameStatus
      }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue([played({})])
      })
    )

    await service.runImport('user-1')

    expect(updateGameStatus).not.toHaveBeenCalled()
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'PLAYSTATION',
      expect.objectContaining({ hoursPlayed: 1 })
    )
  })

  it('throws a ClientError when the played games list is not accessible', async () => {
    const service = makeService(
      fakeUserRepository(),
      fakePsnApi({
        getPlayedGames: vi.fn().mockRejectedValue(new PsnApiError('Access denied'))
      })
    )

    await expect(service.runImport('user-1')).rejects.toBeInstanceOf(ClientError)
  })
})

describe('PsnService.runImport completion detection', () => {
  function importWith(
    trophySummary: PsnTrophySummary,
    psnApiOverrides: Partial<PsnApiService> = {},
    igdbGame: Partial<IGDBGame> = {}
  ) {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 10 })
    vi.spyOn(IGDBService, 'getGamesByExternalIds').mockResolvedValue([
      { uid: '100', game: { id: 10, name: 'Game', ...igdbGame } as IGDBGame }
    ])
    const psnApi = fakePsnApi({
      getPlayedGames: vi.fn().mockResolvedValue([played({ name: 'Game' })]),
      getTrophySummariesByName: vi
        .fn()
        .mockResolvedValue(new Map([['game', trophySummary]])),
      ...psnApiOverrides
    })
    const service = makeService(
      fakeUserRepository({ addGameToUserLibrary }),
      psnApi
    )
    return { service, psnApi, addGameToUserLibrary }
  }

  it('marks a game as played when the share of trophies fits its size, without extra calls', async () => {
    const { service, psnApi, addGameToUserLibrary } = importWith(
      summary({ progress: 45, earned: 22, total: 50 })
    )

    await service.runImport('user-1')

    expect(psnApi.getEarnedTrophies).not.toHaveBeenCalled()
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 1 })
    )
  })

  it('marks a game as played when an earned trophy describes the ending, dated by that trophy', async () => {
    const endingAt = new Date('2024-02-02T20:00:00Z')
    const { service, addGameToUserLibrary } = importWith(
      summary({
        progress: 20,
        earned: 10,
        total: 50,
        lastTrophyAt: new Date('2025-01-01T00:00:00Z')
      }),
      {
        getEarnedTrophies: vi.fn().mockResolvedValue([
          {
            detail: 'Collect 10 feathers',
            earnedAt: new Date('2024-01-01T00:00:00Z'),
            earnedRate: 60
          },
          { detail: 'Watch the credits roll', earnedAt: endingAt, earnedRate: 30 }
        ])
      }
    )

    await service.runImport('user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 1, completedAt: endingAt })
    )
  })

  it('keeps a game unfinished when the trophies give no completion signal', async () => {
    const { service, addGameToUserLibrary } = importWith(
      summary({ progress: 20, earned: 10, total: 50 }),
      {
        getEarnedTrophies: vi.fn().mockResolvedValue([
          { detail: 'Collect 10 feathers', earnedAt: new Date(), earnedRate: 60 }
        ])
      }
    )

    await service.runImport('user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 4 })
    )
  })

  it('does not read trophies for games with almost none earned', async () => {
    const { service, psnApi } = importWith(
      summary({ progress: 2, earned: 1, total: 50 })
    )

    await service.runImport('user-1')

    expect(psnApi.getEarnedTrophies).not.toHaveBeenCalled()
  })

  it('does not infer completion from trophies for multiplayer-only games', async () => {
    const { service, psnApi, addGameToUserLibrary } = importWith(
      summary({ progress: 45, earned: 22, total: 50 }),
      {},
      { game_modes: [{ name: 'Multiplayer' }] } as Partial<IGDBGame>
    )

    await service.runImport('user-1')

    expect(psnApi.getEarnedTrophies).not.toHaveBeenCalled()
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 4 })
    )
  })

  it('still imports when the trophy detail lookup fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { service, addGameToUserLibrary } = importWith(
      summary({ progress: 20, earned: 10, total: 50 }),
      {
        getEarnedTrophies: vi
          .fn()
          .mockRejectedValue(new PsnApiError('Too many requests'))
      }
    )

    const result = await service.runImport('user-1')

    expect(result.library.imported).toBe(1)
    expect(addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, statusIds: 4 })
    )
  })

  it('reads trophies for a limited number of games, highest share first', async () => {
    const games = Array.from({ length: 45 }, (_, i) => ({
      conceptId: String(1000 + i),
      name: `Game ${i}`,
      earned: 10 + Math.floor(i / 5)
    }))
    vi.spyOn(IGDBService, 'getGamesByExternalIds').mockResolvedValue(
      games.map((g, i) => ({
        uid: g.conceptId,
        game: { id: 100 + i, name: g.name } as IGDBGame
      }))
    )
    const getEarnedTrophies = vi.fn().mockResolvedValue([])
    const service = makeService(
      fakeUserRepository({
        addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 })
      }),
      fakePsnApi({
        getPlayedGames: vi.fn().mockResolvedValue(
          games.map((g, i) =>
            played({
              conceptId: g.conceptId,
              titleId: `CUSA${i}_00`,
              name: g.name
            })
          )
        ),
        getTrophySummariesByName: vi.fn().mockResolvedValue(
          new Map(
            games.map((g, i) => [
              `game ${i}`,
              summary({
                progress: 20,
                earned: g.earned,
                total: 50,
                npCommunicationId: `NPWR${i}_00`
              })
            ])
          )
        ),
        getEarnedTrophies
      })
    )

    await service.runImport('user-1')

    expect(getEarnedTrophies).toHaveBeenCalledTimes(40)
    const lookedUp = getEarnedTrophies.mock.calls.map(
      call => call[1].npCommunicationId
    )
    expect(lookedUp).toContain('NPWR44_00')
    expect(lookedUp).not.toContain('NPWR0_00')
  })
})
