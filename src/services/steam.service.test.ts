import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { SteamService } from './steam.service'
import { SteamApiService } from './steam-api.service'
import { IGDBService } from './igdb.service'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { ClientError } from '../errors/client-error'
import { steamImportQueue } from '../queues/steam-import.queue'

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

beforeEach(() => {
  vi.spyOn(SteamApiService, 'getAchievementSchema').mockResolvedValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SteamService.connectSteam', () => {
  it('saves a raw SteamID64 as-is, without resolving', async () => {
    const setSteamId = vi.fn().mockResolvedValue({ steamId: '76561197960287930' })
    const resolveVanityUrl = vi.spyOn(SteamApiService, 'resolveVanityUrl')
    const userRepository = fakeUserRepository({ setSteamId })
    const service = new SteamService(userRepository, fakeGameCacheService())

    const result = await service.connectSteam('user-1', '76561197960287930')

    expect(setSteamId).toHaveBeenCalledWith('user-1', '76561197960287930')
    expect(resolveVanityUrl).not.toHaveBeenCalled()
    expect(result).toEqual({ steamId: '76561197960287930' })
  })

  it('resolves a vanity URL before saving', async () => {
    vi.spyOn(SteamApiService, 'resolveVanityUrl').mockResolvedValue(
      '76561197960287930'
    )
    const setSteamId = vi.fn().mockResolvedValue({ steamId: '76561197960287930' })
    const userRepository = fakeUserRepository({ setSteamId })
    const service = new SteamService(userRepository, fakeGameCacheService())

    const result = await service.connectSteam(
      'user-1',
      'https://steamcommunity.com/id/someVanityName'
    )

    expect(setSteamId).toHaveBeenCalledWith('user-1', '76561197960287930')
    expect(result).toEqual({ steamId: '76561197960287930' })
  })

  it('throws when the vanity URL cannot be resolved', async () => {
    vi.spyOn(SteamApiService, 'resolveVanityUrl').mockResolvedValue(null)
    const userRepository = fakeUserRepository()
    const service = new SteamService(userRepository, fakeGameCacheService())

    await expect(
      service.connectSteam('user-1', 'nonexistent-vanity')
    ).rejects.toThrow(ClientError)
  })
})

describe('SteamService.enqueueImport', () => {
  it('throws when the user has not connected Steam yet', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1', steamId: null })
    })
    const service = new SteamService(userRepository, fakeGameCacheService())

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
    const service = new SteamService(userRepository, fakeGameCacheService())

    await expect(service.enqueueImport('user-1')).rejects.toThrow(ClientError)
  })
})

describe('SteamService.runImport', () => {
  beforeEach(() => {
    vi.spyOn(SteamApiService, 'getWishlist').mockResolvedValue([])
  })

  it('imports matched games, skips existing ones, and lists unmatched by name', async () => {
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

    const service = new SteamService(userRepository, gameCacheService)

    const result = await service.runImport('user-1')

    expect(result).toEqual({
      library: {
        imported: 2,
        skipped: 1,
        notFound: ['Obscure Unmatched Game']
      },
      wishlist: { imported: 0, skipped: 0, notFound: [] }
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
    expect(userRepository.upsertUserGameHours).toHaveBeenCalledWith(
      'user-1',
      2,
      2
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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1,
      completedAt: expect.any(Date)
    })
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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

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

    const service = new SteamService(userRepository, fakeGameCacheService())

    const result = await service.runImport('user-1')

    expect(result).toEqual({
      library: { imported: 0, skipped: 0, notFound: [] },
      wishlist: { imported: 1, skipped: 0, notFound: ['App 999999'] }
    })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 3,
      userId: 'user-1',
      statusIds: 5
    })
    expect(userRepository.upsertUserGameHours).not.toHaveBeenCalled()
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

    const service = new SteamService(userRepository, fakeGameCacheService())

    const result = await service.runImport('user-1')

    expect(result.wishlist).toEqual({ imported: 0, skipped: 1, notFound: [] })
  })

  it('throws when the Steam profile is private or invalid', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', steamId: '76561197960287930' })
    })
    vi.spyOn(SteamApiService, 'getOwnedGames').mockResolvedValue(null)
    const service = new SteamService(userRepository, fakeGameCacheService())

    await expect(service.runImport('user-1')).rejects.toThrow(ClientError)
  })
})
