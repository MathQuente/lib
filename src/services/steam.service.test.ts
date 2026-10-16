import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { SteamService } from './steam.service'
import { SteamApiError, SteamApiService } from './steam-api.service'
import { IGDBService } from './igdb.service'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { ClientError } from '../errors/client-error'
import { steamImportQueue } from '../queues/steam-import.queue'
import {
  fakePlatformService,
  FakePlatformRepository
} from '../test-utils/fake-platform-service'

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return {
    findUserById: vi.fn().mockResolvedValue({ id: 'user-1', steamId: null }),
    ...overrides
  } as unknown as UserRepository
}

function fakeGameCacheService(
  overrides: Partial<GameCacheService> = {}
): GameCacheService {
  return {
    cacheMany: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as GameCacheService
}

let lastPlatformRepository: FakePlatformRepository

function platformServiceFor(userRepository: UserRepository) {
  const fake = fakePlatformService(userRepository)
  lastPlatformRepository = fake.platformRepository
  return fake.service
}

beforeEach(() => {
  vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SteamService.connectSteam', () => {
  it('saves the verified SteamID64', async () => {
    const setSteamId = vi.fn().mockResolvedValue({ steamId: '76561197960287930' })
    const userRepository = fakeUserRepository({ setSteamId })
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    const result = await service.connectSteam('user-1', '76561197960287930')

    expect(setSteamId).toHaveBeenCalledWith('user-1', '76561197960287930')
    expect(result).toEqual({ steamId: '76561197960287930' })
  })

  it('throws 409 when the Steam account is linked to another user', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test'
    })
    const userRepository = fakeUserRepository({
      setSteamId: vi.fn().mockRejectedValue(duplicate)
    })
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await expect(
      service.connectSteam('user-1', '76561197960287930')
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('SteamService.enqueueImport', () => {
  it('throws when the user has not connected Steam yet', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1', steamId: null })
    })
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await expect(service.enqueueImport('user-1')).rejects.toThrow(ClientError)
  })

  it('throws 409 when a job is already waiting/active', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' })
    })
    vi.spyOn(steamImportQueue, 'getJob').mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active')
    } as never)
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await expect(service.enqueueImport('user-1')).rejects.toThrow(ClientError)
  })
})

let communityTextsSpy: ReturnType<typeof vi.spyOn>

describe('SteamService.runImport', () => {
  beforeEach(() => {
    vi.spyOn(SteamApiService, 'getWishlist').mockResolvedValue([])
    vi.spyOn(IGDBService, 'getTimeToBeatByGameIds').mockResolvedValue(new Map())
  })

  async function importSingleGame({
    playtimeMinutes,
    normallySeconds,
    achieved,
    total,
    genres = [],
    gameModes = [{ name: 'Single player' }],
    timeToBeatFails = false,
    achievedApiNames = [],
    communityTexts = null,
    schema = null
  }: {
    playtimeMinutes: number
    normallySeconds?: number
    achieved: number
    total: number
    genres?: { name: string }[]
    gameModes?: { name: string }[]
    timeToBeatFails?: boolean
    achievedApiNames?: string[]
    communityTexts?: Map<string, string> | null
    schema?: Map<string, string> | null
  }) {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 7 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })
    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 1174180,
        name: 'Game',
        playtime_forever: playtimeMinutes,
        rtime_last_played: 0
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 1174180,
        game: { id: 7, name: 'Game', genres, game_modes: gameModes }
      }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved,
      total,
      achievedApiNames,
      unlockTimesByName: new Map()
    })
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )
    vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(schema)
    communityTextsSpy = vi
      .spyOn(SteamApiService, 'getUnlockedAchievementTexts')
      .mockResolvedValue(communityTexts)
    const timeToBeat = vi.spyOn(IGDBService, 'getTimeToBeatByGameIds')
    if (timeToBeatFails) timeToBeat.mockRejectedValue(new Error('igdb down'))
    else
      timeToBeat.mockResolvedValue(
        normallySeconds ? new Map([[7, normallySeconds]]) : new Map()
      )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )
    await service.runImport('user-1')

    return userRepository.addGameToUserLibrary as ReturnType<typeof vi.fn>
  }

  it('marks a new game as PLAYED when playtime reaches the usual time to beat and enough achievements are earned', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 108 * 60,
      normallySeconds: 89.5 * 3600,
      achieved: 20,
      total: 51
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 1 })
    )
  })

  it.each([
    ['few achievements are earned', { achieved: 8, total: 51 }, 90 * 3600],
    ['playtime is below the time to beat', { achieved: 15, total: 51 }, 200 * 3600],
    ['the time to beat is unknown', { achieved: 15, total: 51 }, undefined]
  ])('keeps a new game out of PLAYED when %s', async (_label, ach, normally) => {
    const addGame = await importSingleGame({
      playtimeMinutes: 100 * 60,
      normallySeconds: normally,
      ...ach
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 4 })
    )
  })

  it('still imports the game when the time to beat lookup fails', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 100 * 60,
      achieved: 5,
      total: 51,
      timeToBeatFails: true
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 4 })
    )
  })

  it('marks a game as played from a hidden achievement described only on the community page (Yakuza Kiwami-shaped)', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 23 * 60,
      achieved: 21,
      total: 55,
      achievedApiNames: ['38_Thank_You', '12_Tell_Me_A_Story'],
      communityTexts: new Map([
        ['38_thank_you', 'Thank You! Completed the final chapter.'],
        ['12_tell_me_a_story', 'Tell Me a Story Completed 10 substories.']
      ])
    })

    expect(communityTextsSpy).toHaveBeenCalledWith('76561197960287930', 1174180)
    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 1 })
    )
  })

  it('does not ask the community page when the schema already shows a finishing achievement', async () => {
    await importSingleGame({
      playtimeMinutes: 20 * 60,
      achieved: 10,
      total: 40,
      achievedApiNames: ['END'],
      schema: new Map([['END', 'Watch the credits']])
    })

    expect(communityTextsSpy).not.toHaveBeenCalled()
  })

  it('does not ask the community page for a game with too few earned achievements', async () => {
    await importSingleGame({
      playtimeMinutes: 20 * 60,
      achieved: 3,
      total: 40,
      achievedApiNames: ['A']
    })

    expect(communityTextsSpy).not.toHaveBeenCalled()
  })

  it('keeps a game out of played when the community texts do not describe an ending', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 5 * 60,
      achieved: 6,
      total: 55,
      achievedApiNames: ['A'],
      communityTexts: new Map([['a', 'Tutorial Complete the tutorial.']])
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 4 })
    )
  })

  it('analyses a single-player sport game by achievements (Punch Club-shaped)', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 20 * 60,
      achieved: 36,
      total: 47,
      genres: [{ name: 'Sport' }, { name: 'Strategy' }]
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 1 })
    )
  })

  it('does not read achievements for a multiplayer sport game', async () => {
    const addGame = await importSingleGame({
      playtimeMinutes: 90 * 60,
      achieved: 36,
      total: 40,
      genres: [{ name: 'Sport' }],
      gameModes: [{ name: 'Single player' }, { name: 'Multiplayer' }]
    })

    expect(addGame).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 7, statusIds: 4 })
    )
  })

  it('imports matched games, updates existing ones, and lists unmatched by name', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi
        .fn()
        .mockImplementation((igdbId: number) =>
          Promise.resolve(igdbId === 999 ? { igdbId, UserGamesStatus: { id: 4 } } : null)
        ),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })
    const gameCacheService = fakeGameCacheService()

    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      { appid: 440, name: 'Team Fortress 2', playtime_forever: 0 },
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 120,
        rtime_last_played: oneDayAgo
      },
      { appid: 999, name: 'Already Owned Game', playtime_forever: 60 },
      { appid: 111, name: 'Obscure Unmatched Game', playtime_forever: 30 }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 440, game: { id: 1, name: 'Team Fortress 2' } },
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } },
      { appId: 999, game: { id: 999, name: 'Already Owned Game' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue(null)
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )

    const service = new SteamService(
      userRepository,
      gameCacheService,
      platformServiceFor(userRepository)
    )

    const result = await service.runImport('user-1')

    expect(result).toEqual({
      library: {
        imported: 2,
        updated: 1,
        skipped: 0,
        notFound: ['Obscure Unmatched Game']
      },
      wishlist: { imported: 0, updated: 0, skipped: 0, notFound: [] }
    })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 1,
      userId: 'user-1',
      statusIds: 4
    })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 3
    })
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-2',
      'STEAM',
      expect.objectContaining({ hoursPlayed: 2 })
    )
  })

  it('puts games with playtime but not played in the last 14 days in BACKLOG, not PLAYING', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })
    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 500,
        rtime_last_played: oneYearAgo
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue(null)
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 4
    })
  })

  it('marks a game as PLAYED when achievement completion is at or above 90%', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 18,
      total: 20,
      achievedApiNames: [],
      unlockTimesByName: new Map()
    })
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: expect.any(Date)
    })
  })

  it.each([
    ['18 of 20 achievements is only the heuristic', 18, 3],
    ['every achievement is confirmed', 20, 1]
  ])(
    'for a game already in the library, %s',
    async (_label, achieved, expectedStatusId) => {
      const updateGameStatus = vi.fn().mockResolvedValue(null)
      const userRepository = fakeUserRepository({
        findUserById: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
        findUserGame: vi
          .fn()
          .mockResolvedValue({ igdbId: 2, UserGamesStatus: { id: 2 } }),
        updateGameStatus
      })

      vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
        {
          appid: 730,
          name: 'Counter-Strike 2',
          playtime_forever: 500,
          rtime_last_played: Math.floor(Date.now() / 1000)
        }
      ])
      vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
        { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
      ] as never)
      vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
        achieved,
        total: 20,
        achievedApiNames: [],
        unlockTimesByName: new Map()
      })
      vi.spyOn(
        SteamApiService,
        'getGlobalAchievementPercentages'
      ).mockResolvedValue(null)

      const service = new SteamService(
        userRepository,
        fakeGameCacheService(),
        platformServiceFor(userRepository)
      )

      await service.runImport('user-1')

      expect(updateGameStatus).toHaveBeenCalledTimes(1)
      expect(updateGameStatus).toHaveBeenCalledWith(
        2,
        'user-1',
        expectedStatusId
      )
      expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
        'ug-2',
        'STEAM',
        expect.objectContaining({
          completions: expectedStatusId === 1 ? 1 : 0
        })
      )
    }
  )

  it('does not upgrade an existing game on a trivially small achievement set', async () => {
    const updateGameStatus = vi.fn().mockResolvedValue(null)
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi
        .fn()
        .mockResolvedValue({ igdbId: 2, UserGamesStatus: { id: 2 } }),
      updateGameStatus
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 1,
      total: 1,
      achievedApiNames: [],
      unlockTimesByName: new Map()
    })
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(updateGameStatus).toHaveBeenCalledWith(2, 'user-1', 3)
  })

  it('does not treat a trivially small achievement set as a completion signal', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 1,
      total: 1,
      achievedApiNames: [],
      unlockTimesByName: new Map()
    })
    vi.spyOn(SteamApiService, 'getGlobalAchievementPercentages').mockResolvedValue(
      null
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 3
    })
  })

  it('marks a game as PLAYED via a rare achievement even when the overall ratio is low', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 730, game: { id: 2, name: 'Counter-Strike 2' } }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 10,
      total: 100,
      achievedApiNames: ['ACH_FIRST_STEPS', 'ACH_BEAT_THE_GAME'],
      unlockTimesByName: new Map()
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(
      new Map([
        ['ACH_FIRST_STEPS', 80],
        ['ACH_BEAT_THE_GAME', 3]
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: expect.any(Date)
    })
  })

  it('never trusts achievements for a game with no single-player mode at all', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 1849110,
        name: 'EA Sports FC 26',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 1849110,
        game: {
          id: 2,
          name: 'EA Sports FC 26',
          game_modes: [{ name: 'Multiplayer' }]
        }
      }
    ] as never)
    const getPlayerAchievements = vi.spyOn(
      SteamApiService,
      'getPlayerAchievements'
    )
    const getGlobalAchievementPercentages = vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(getPlayerAchievements).not.toHaveBeenCalled()
    expect(getGlobalAchievementPercentages).not.toHaveBeenCalled()

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 3
    })
  })

  it('still trusts achievements for a single-player game that also has co-op/multiplayer (Dark Souls-shaped)', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 374320,
        name: 'DARK SOULS III',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 374320,
        game: {
          id: 2,
          name: 'Dark Souls III',
          game_modes: [
            { name: 'Single player' },
            { name: 'Multiplayer' },
            { name: 'Co-operative' }
          ]
        }
      }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 40,
      total: 41,
      achievedApiNames: [],
      unlockTimesByName: new Map()
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(null)

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: expect.any(Date)
    })
  })

  it('regression: an ending achievement reads as completion even when it is not rare (Dark Souls: Remastered)', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 570940,
        name: 'DARK SOULS: REMASTERED',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 570940,
        game: {
          id: 2,
          name: 'Dark Souls: Remastered',
          game_modes: [
            { name: 'Single player' },
            { name: 'Multiplayer' },
            { name: 'Co-operative' }
          ]
        }
      }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 19,
      total: 41,
      achievedApiNames: ['ACHIEVEMENT_FRPG_ACHIEVEMENTS_01'],
      unlockTimesByName: new Map()
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(new Map([['ACHIEVEMENT_FRPG_ACHIEVEMENTS_01', 31.2]]))
    vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(
      new Map([
        [
          'ACHIEVEMENT_FRPG_ACHIEVEMENTS_01',
          'Reach "To Link the Fire" ending.'
        ]
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: expect.any(Date)
    })
  })

  it('uses the completion-keyword achievement unlocktime as completedAt, not the latest unlock', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 570940,
        name: 'DARK SOULS: REMASTERED',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 570940,
        game: {
          id: 2,
          name: 'Dark Souls: Remastered',
          game_modes: [{ name: 'Single player' }]
        }
      }
    ] as never)

    const endingUnlockTime = 1_700_000_000
    const laterGrindUnlockTime = 1_705_000_000

    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 2,
      total: 41,
      achievedApiNames: ['ACHIEVEMENT_FRPG_ACHIEVEMENTS_01', 'ACH_POST_ENDING_GRIND'],
      unlockTimesByName: new Map([
        ['ACHIEVEMENT_FRPG_ACHIEVEMENTS_01', endingUnlockTime],
        ['ACH_POST_ENDING_GRIND', laterGrindUnlockTime]
      ])
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(new Map([['ACHIEVEMENT_FRPG_ACHIEVEMENTS_01', 31.2]]))
    vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(
      new Map([
        [
          'ACHIEVEMENT_FRPG_ACHIEVEMENTS_01',
          'Reach "To Link the Fire" ending.'
        ],
        ['ACH_POST_ENDING_GRIND', 'Some unrelated grind achievement.']
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: new Date(endingUnlockTime * 1000)
    })
  })

  it('falls back to the latest unlock time when only the ratio threshold matches (no specific completion achievement)', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 1,
        name: 'Some Game',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000)
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 1,
        game: {
          id: 2,
          name: 'Some Game',
          game_modes: [{ name: 'Single player' }]
        }
      }
    ] as never)

    const earlierUnlockTime = 1_700_000_000
    const latestUnlockTime = 1_701_000_000

    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 9,
      total: 10,
      achievedApiNames: ['ACH_1', 'ACH_2'],
      unlockTimesByName: new Map([
        ['ACH_1', earlierUnlockTime],
        ['ACH_2', latestUnlockTime]
      ])
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(new Map([['ACH_1', 40], ['ACH_2', 35]]))
    vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(
      new Map([
        ['ACH_1', 'Did a normal thing.'],
        ['ACH_2', 'Did another normal thing.']
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: new Date(latestUnlockTime * 1000)
    })
  })

  it('regression: a hard-but-optional achievement in the 8-15% range does not read as completion (Necroking)', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 2852980,
        name: 'Necroking',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 2852980,
        game: {
          id: 2,
          name: 'Necroking',
          game_modes: [{ name: 'Single player' }]
        }
      }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 13,
      total: 38,
      achievedApiNames: [
        'Limit_of_Possibilities',
        'Elite_Squad',
        'Uncontrollable_Rage'
      ],
      unlockTimesByName: new Map()
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(
      new Map([
        ['Limit_of_Possibilities', 69.4],
        ['Elite_Squad', 12.3],
        ['Uncontrollable_Rage', 8.1],
        ['Supreme_Ruler', 2.7]
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 4
    })
  })

  it('regression: a rare achievement in a sprawling completionist list does not read as completion (Tower Unite)', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([
      {
        appid: 394690,
        name: 'Tower Unite',
        playtime_forever: 500,
        rtime_last_played: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
      }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      {
        appId: 394690,
        game: {
          id: 2,
          name: 'Tower Unite',
          game_modes: [
            { name: 'Single player' },
            { name: 'Multiplayer' },
            { name: 'Co-operative' },
            { name: 'Massively Multiplayer Online (MMO)' }
          ]
        }
      }
    ] as never)
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 33,
      total: 651,
      achievedApiNames: ['ACH_GW_BR_AROUNDWORLD', 'ACH_GW_BR_MASTER'],
      unlockTimesByName: new Map()
    })
    vi.spyOn(
      SteamApiService,
      'getGlobalAchievementPercentages'
    ).mockResolvedValue(
      new Map([
        ['ACH_GW_BR_AROUNDWORLD', 3.4],
        ['ACH_GW_BR_MASTER', 16.2]
      ])
    )

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 4
    })
  })

  it('imports wishlist items as WISHLIST status, separately from the library', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 1 }),
      upsertUserGameHours: vi.fn().mockResolvedValue({ hoursPlayed: 1 })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([])
    vi.spyOn(SteamApiService, 'getWishlist').mockResolvedValue([
      { appid: 1091500 },
      { appid: 999999 }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 1091500, game: { id: 3, name: "Cyberpunk 2077" } }
    ] as never)

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    const result = await service.runImport('user-1')

    expect(result).toEqual({
      library: { imported: 0, updated: 0, skipped: 0, notFound: [] },
      wishlist: {
        imported: 1,
        updated: 0,
        skipped: 0,
        notFound: ['App 999999']
      }
    })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 3,
      userId: 'user-1',
      statusIds: 5
    })
    expect(userRepository.createUserGameStats).toHaveBeenCalledWith(
      'user-1',
      expect.any(Number),
      0
    )
    expect(lastPlatformRepository.savePlatform).not.toHaveBeenCalled()
  })

  it('skips a wishlist item already present in the library under another status', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' }),
      findUserGame: vi
        .fn()
        .mockResolvedValue({ igdbId: 3, UserGamesStatus: { id: 3 } })
    })

    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue([])
    vi.spyOn(SteamApiService, 'getWishlist').mockResolvedValue([
      { appid: 1091500 }
    ])
    vi.spyOn(IGDBService, 'getGamesBySteamAppIds').mockResolvedValue([
      { appId: 1091500, game: { id: 3, name: "Cyberpunk 2077" } }
    ] as never)

    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    const result = await service.runImport('user-1')

    expect(result.wishlist).toEqual({
      imported: 0,
      updated: 0,
      skipped: 1,
      notFound: []
    })
  })

  it.each([
    ['rate limited', 429, 503, /limite de consultas/],
    ['unavailable', 500, 502, /consultar a Steam agora/],
    ['rejecting the key', 403, 502, /consultar a Steam agora/],
    ['unreachable', undefined, 502, /consultar a Steam agora/]
  ])(
    'tells the user Steam is the problem, not the profile, when Steam is %s',
    async (_label, status, expectedCode, message) => {
      const userRepository = fakeUserRepository({
        findUserById: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' })
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(SteamApiService, 'getOwnedGames').mockRejectedValue(
        new SteamApiError('down', status)
      )
      const service = new SteamService(
        userRepository,
        fakeGameCacheService(),
        platformServiceFor(userRepository)
      )

      const error = await service.runImport('user-1').catch(e => e)

      expect(error).toBeInstanceOf(ClientError)
      expect(error.statusCode).toBe(expectedCode)
      expect(error.message).toMatch(message)
      expect(console.error).toHaveBeenCalledWith(
        '[Steam] owned games failed',
        expect.objectContaining({ status })
      )
    }
  )

  it('still asks for a public profile when Steam answers without games', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' })
    })
    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue(null)
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    const error = await service.runImport('user-1').catch(e => e)

    expect(error.statusCode).toBe(400)
    expect(error.message).toMatch(/perfil está público/)
  })

  it('throws when the Steam profile is private or invalid', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' })
    })
    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue(null)
    const service = new SteamService(
      userRepository,
      fakeGameCacheService(),
      platformServiceFor(userRepository)
    )

    await expect(service.runImport('user-1')).rejects.toThrow(ClientError)
  })
})
