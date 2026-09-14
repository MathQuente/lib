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
    // Default to an empty wishlist so every test that doesn't care about it
    // isn't making a real network call.
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
      statusIds: 4 // BACKLOG — playtime_forever 0
    })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 3 // PLAYING — playtime_forever > 0
    })
    expect(userRepository.upsertUserGameHours).toHaveBeenCalledWith(
      'user-1',
      2,
      2 // 120 minutes -> 2 hours
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

    const service = new SteamService(userRepository, fakeGameCacheService())

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 4 // BACKLOG — not touched in over a year despite playtime
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
      total: 20
    })

    const service = new SteamService(userRepository, fakeGameCacheService())

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 1 // PLAYED — 90% achievements, overrides recency-based PLAYING
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
    // 1/1 = 100% but below MIN_ACHIEVEMENTS_FOR_SIGNAL — shouldn't count.
    vi.spyOn(SteamApiService, 'getPlayerAchievements').mockResolvedValue({
      achieved: 1,
      total: 1
    })

    const service = new SteamService(userRepository, fakeGameCacheService())

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 2,
      userId: 'user-1',
      statusIds: 3 // PLAYING — recently played, achievement count too small to trust
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
      { appid: 999999 } // unmatched
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
      statusIds: 5 // WISHLIST
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
