import { describe, it, expect, vi, afterEach } from 'vitest'
import { UserService } from './users.service'
import { IGDBService } from './igdb.service'
import { GameCacheService } from './game-cache.service'
import { UserRepository } from '../repositories/users.repository'
import { PaginatedUserGameRow } from '../types/user'
import { RatingRepository } from '../repositories/rating.repository'
import { FollowRepository } from '../repositories/follow.repository'
import { ClientError } from '../errors/client-error'
import { CacheRepository } from '../repositories/cache.repository'
import { SteamApiService } from './steam-api.service'

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return { ...overrides } as unknown as UserRepository
}

function fakeRatingRepository(
  overrides: Partial<RatingRepository> = {}
): RatingRepository {
  return { ...overrides } as unknown as RatingRepository
}

function fakeFollowRepository(
  overrides: Partial<FollowRepository> = {}
): FollowRepository {
  return { ...overrides } as unknown as FollowRepository
}

function fakeGameCacheService(
  overrides: Partial<GameCacheService> = {}
): GameCacheService {
  return {
    ensureCached: vi.fn().mockResolvedValue(true),
    cacheMany: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as GameCacheService
}

function statusCounts(counts: Partial<Record<string, number>>) {
  const all = ['PLAYED', 'PLAYING', 'PAUSED', 'BACKLOG', 'WISHLIST', 'DROPPED']
  return all.map(status => ({
    status,
    _count: { userGames: counts[status] ?? 0 }
  }))
}

describe('UserService.addGameToUserLibrary', () => {
  it('throws ClientError when the igdbId is not a real IGDB game', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' })
    })
    const gameCacheService = fakeGameCacheService({
      ensureCached: vi.fn().mockResolvedValue(false)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      gameCacheService,
      fakeFollowRepository()
    )

    await expect(
      service.addGameToUserLibrary(999999, 'user-1', 1)
    ).rejects.toThrow(ClientError)
  })

  it('adds the game when the igdbId is a real IGDB game', async () => {
    const addGameToUserLibrary = vi
      .fn()
      .mockResolvedValue({ igdbId: 1022 })
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary,
      createUserGameStats: vi.fn().mockResolvedValue({ completions: 0 })
    })
    const gameCacheService = fakeGameCacheService()
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      gameCacheService,
      fakeFollowRepository()
    )

    const result = await service.addGameToUserLibrary(1022, 'user-1', 1)

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 1022,
      statusIds: 1,
      userId: 'user-1'
    })
    expect(result).toEqual({ igdbId: 1022 })
  })
})

describe('UserService.findManyUserGames', () => {
  it('throws ClientError when the user does not exist', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue(null)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await expect(
      service.findManyUserGames('missing-user', 0, undefined, undefined, 'gameName', 'asc')
    ).rejects.toThrow(ClientError)
  })

  it('calls the repository with skip/take derived from pageIndex when a status filter is set', async () => {
    const findManyGamesOfUser = vi.fn().mockResolvedValue([])
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser,
      findGamesCountByStatus: vi.fn().mockResolvedValue(statusCounts({}))
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await service.findManyUserGames('user-1', 2, 'PLAYED', undefined, 'rating', 'desc')

    expect(findManyGamesOfUser).toHaveBeenCalledWith({
      userId: 'user-1',
      filter: 'PLAYED',
      query: undefined,
      sortBy: 'rating',
      sortOrder: 'desc',
      skip: 80,
      take: 40
    })
  })

  it('fetches unpaginated when no status filter is set, so one large bucket cannot crowd the others out', async () => {
    const findManyGamesOfUser = vi.fn().mockResolvedValue([])
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser,
      findGamesCountByStatus: vi.fn().mockResolvedValue(statusCounts({}))
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await service.findManyUserGames('user-1', 0, undefined, undefined, 'rating', 'desc')

    expect(findManyGamesOfUser).toHaveBeenCalledWith({
      userId: 'user-1',
      filter: undefined,
      query: undefined,
      sortBy: 'rating',
      sortOrder: 'desc',
      skip: undefined,
      take: undefined
    })
  })

  it('groups the paginated rows by status', async () => {
    const rows: PaginatedUserGameRow[] = [
      {
        igdbId: 1,
        status: 'PLAYED' as PaginatedUserGameRow['status'],
        name: 'Game A',
        coverUrl: null,
        platforms: ['PC'],
        releaseDate: 100,
        rating: 4,
        completions: 0,
        hoursPlayed: 0,
        playedOn: []
      },
      {
        igdbId: 2,
        status: 'BACKLOG' as PaginatedUserGameRow['status'],
        name: 'Game B',
        coverUrl: null,
        platforms: [],
        releaseDate: 200,
        rating: null,
        completions: 0,
        hoursPlayed: 0,
        playedOn: []
      }
    ]
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser: vi.fn().mockResolvedValue(rows),
      findGamesCountByStatus: vi
        .fn()
        .mockResolvedValue(statusCounts({ PLAYED: 1, BACKLOG: 1 }))
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    const result = await service.findManyUserGames(
      'user-1',
      0,
      undefined,
      undefined,
      'gameName',
      'asc'
    )

    expect(result.games.PLAYED.map(g => g.igdbId)).toEqual([1])
    expect(result.games.BACKLOG.map(g => g.igdbId)).toEqual([2])
    expect(result.total).toBe(2)
  })

  it('backfills name/coverUrl/releaseDate from IGDB only for rows missing games_cache data', async () => {
    const rows: PaginatedUserGameRow[] = [
      {
        igdbId: 1,
        status: 'PLAYED' as PaginatedUserGameRow['status'],
        name: 'Cached Game',
        coverUrl: 'https://img/cached.jpg',
        platforms: ['PC'],
        releaseDate: 100,
        rating: 4,
        completions: 0,
        hoursPlayed: 0,
        playedOn: []
      },
      {
        igdbId: 99,
        status: 'BACKLOG' as PaginatedUserGameRow['status'],
        name: null,
        coverUrl: null,
        platforms: null,
        releaseDate: null,
        rating: null,
        completions: 0,
        hoursPlayed: 0,
        playedOn: []
      }
    ]
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser: vi.fn().mockResolvedValue(rows),
      findGamesCountByStatus: vi
        .fn()
        .mockResolvedValue(statusCounts({ PLAYED: 1, BACKLOG: 1 }))
    })
    const getGamesByIds = vi
      .spyOn(IGDBService, 'getGamesByIds')
      .mockResolvedValue([
        {
          id: 99,
          name: 'Fetched Game',
          cover: { url: '//img/thumb.jpg' },
          platforms: [{ name: 'Switch' }],
          first_release_date: 555
        }
      ] as Awaited<ReturnType<typeof IGDBService.getGamesByIds>>)
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    const result = await service.findManyUserGames(
      'user-1',
      0,
      undefined,
      undefined,
      'gameName',
      'asc'
    )

    expect(getGamesByIds).toHaveBeenCalledWith([99])
    expect(result.games.BACKLOG[0]).toMatchObject({
      igdbId: 99,
      name: 'Fetched Game',
      releaseDate: 555
    })

    getGamesByIds.mockRestore()
  })

  it('maps a null releaseDate from the repository to undefined in the response', async () => {
    const rows: PaginatedUserGameRow[] = [
      {
        igdbId: 1,
        status: 'WISHLIST' as PaginatedUserGameRow['status'],
        name: 'No Release Date',
        coverUrl: null,
        platforms: [],
        releaseDate: null,
        rating: null,
        completions: 0,
        hoursPlayed: 0,
        playedOn: []
      }
    ]
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser: vi.fn().mockResolvedValue(rows),
      findGamesCountByStatus: vi
        .fn()
        .mockResolvedValue(statusCounts({ WISHLIST: 1 }))
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    const result = await service.findManyUserGames(
      'user-1',
      0,
      undefined,
      undefined,
      'gameName',
      'asc'
    )

    expect(result.games.WISHLIST[0].releaseDate).toBeUndefined()
  })
})

describe('UserService.findGamesToDisplay', () => {
  function serviceWithLibrary(rows: Array<{ igdbId: number; status: string }>) {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findManyGamesOfUser: vi.fn().mockResolvedValue(rows)
    })
    return new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )
  }

  it('suggests a paused game before any backlog game', async () => {
    const getGameById = vi
      .spyOn(IGDBService, 'getGameById')
      .mockResolvedValue({ id: 20, name: 'Paused game' })
    const service = serviceWithLibrary([
      { igdbId: 10, status: 'BACKLOG' },
      { igdbId: 20, status: 'PAUSED' },
      { igdbId: 30, status: 'DROPPED' }
    ])

    const result = await service.findGamesToDisplay('user-1')

    expect(getGameById).toHaveBeenCalledWith(20)
    expect(result.game?.igdbId).toBe(20)
    expect(result.message).toBe('Que tal retomar este?')
    getGameById.mockRestore()
  })

  it('falls back to the backlog when nothing is paused', async () => {
    const getGameById = vi
      .spyOn(IGDBService, 'getGameById')
      .mockResolvedValue({ id: 10, name: 'Backlog game' })
    const service = serviceWithLibrary([
      { igdbId: 10, status: 'BACKLOG' },
      { igdbId: 30, status: 'DROPPED' }
    ])

    const result = await service.findGamesToDisplay('user-1')

    expect(getGameById).toHaveBeenCalledWith(10)
    expect(result.message).toBe('Tire a poeira desses jogos esquecidos.')
    getGameById.mockRestore()
  })
})

describe('UserService.updateGame', () => {
  it('deletes an existing rating when moving to WISHLIST', async () => {
    const deleteRating = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 3 } }),
      updateGameStatus: vi.fn().mockResolvedValue({
        igdbId: 11133,
        UserGamesStatus: { id: 5, status: 'WISHLIST' }
      })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue({ value: 4 }),
      delete: deleteRating
    })
    const service = new UserService(
      userRepository,
      ratingRepository,
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await service.updateGame(11133, 'user-1', 5)

    expect(deleteRating).toHaveBeenCalledWith(11133, 'user-1')
  })

  it('does not try to delete when there is no rating', async () => {
    const deleteRating = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 3 } }),
      updateGameStatus: vi.fn().mockResolvedValue({
        igdbId: 11133,
        UserGamesStatus: { id: 5, status: 'WISHLIST' }
      })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue(null),
      delete: deleteRating
    })
    const service = new UserService(
      userRepository,
      ratingRepository,
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await service.updateGame(11133, 'user-1', 5)

    expect(deleteRating).not.toHaveBeenCalled()
  })

  it('does not touch the rating when moving to a non-WISHLIST status', async () => {
    const findUniqueByUserGame = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 5 } }),
      updateGameStatus: vi.fn().mockResolvedValue({
        igdbId: 11133,
        UserGamesStatus: { id: 4, status: 'BACKLOG' }
      })
    })
    const ratingRepository = fakeRatingRepository({ findUniqueByUserGame })
    const service = new UserService(
      userRepository,
      ratingRepository,
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await service.updateGame(11133, 'user-1', 4)

    expect(findUniqueByUserGame).not.toHaveBeenCalled()
  })
})

describe('UserService.findById', () => {
  it('returns the full profile, without linked accounts, including follow counts', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        userName: 'matheus',
        profilePicture: 'pic.png',
        userBanner: 'banner.png',
        steamId: '12345',
        psnOnlineId: 'psn-user',
        _count: { userGames: 3 }
      }),
      countUserGames: vi
        .fn()
        .mockResolvedValue({ _count: { userGames: 3 } }),
      sumUserHoursPlayed: vi.fn().mockResolvedValue(12.5)
    })
    const followRepository = fakeFollowRepository({
      countFollowers: vi.fn().mockResolvedValue(2),
      countFollowing: vi.fn().mockResolvedValue(5)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      followRepository
    )

    const { user } = await service.findById('user-1')

    expect(user).toEqual({
      id: 'user-1',
      profilePicture: 'pic.png',
      userBanner: 'banner.png',
      userName: 'matheus',
      gamesAmount: 3,
      totalHoursPlayed: 12.5,
      followersCount: 2,
      followingCount: 5
    })
    expect(user).not.toHaveProperty('steamId')
    expect(user).not.toHaveProperty('psnOnlineId')
  })
})

describe('UserService.findMe', () => {
  function build(options: {
    steamId?: string | null
    cache?: Partial<CacheRepository>
  } = {}) {
    const cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      ...options.cache
    }
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        userName: 'matheus',
        email: 'matheus@a.com',
        emailVerifiedAt: null,
        profilePicture: 'pic.png',
        userBanner: 'banner.png',
        steamId: options.steamId === undefined ? '12345' : options.steamId,
        psnOnlineId: 'psn-user',
        _count: { userGames: 3 }
      }),
      sumUserHoursPlayed: vi.fn().mockResolvedValue(12.5)
    })
    const followRepository = fakeFollowRepository({
      countFollowers: vi.fn().mockResolvedValue(2),
      countFollowing: vi.fn().mockResolvedValue(5)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      followRepository,
      undefined,
      cache as unknown as CacheRepository
    )
    return { service, cache }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the full self profile, including linked accounts and follow counts', async () => {
    vi.spyOn(SteamApiService, 'getPersonaName').mockResolvedValue('Matheus')
    const { service } = build()

    const { user } = await service.findMe('user-1')

    expect(user).toEqual({
      id: 'user-1',
      profilePicture: 'pic.png',
      userBanner: 'banner.png',
      userName: 'matheus',
      email: 'matheus@a.com',
      emailVerified: false,
      gamesAmount: 3,
      totalHoursPlayed: 12.5,
      steamId: '12345',
      steamPersonaName: 'Matheus',
      psnOnlineId: 'psn-user',
      followersCount: 2,
      followingCount: 5
    })
  })

  it('caches the Steam profile name for six hours', async () => {
    vi.spyOn(SteamApiService, 'getPersonaName').mockResolvedValue('Matheus')
    const { service, cache } = build()

    await service.findMe('user-1')

    expect(cache.set).toHaveBeenCalledWith(
      'steam:persona:12345',
      { name: 'Matheus' },
      6 * 60 * 60
    )
  })

  it('does not call Steam when the name is already cached', async () => {
    const getPersonaName = vi.spyOn(SteamApiService, 'getPersonaName')
    const { service } = build({
      cache: { get: vi.fn().mockResolvedValue({ name: 'Cached' }) }
    })

    const { user } = await service.findMe('user-1')

    expect(user.steamPersonaName).toBe('Cached')
    expect(getPersonaName).not.toHaveBeenCalled()
  })

  it('returns a null name and caches the failure briefly when Steam fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(SteamApiService, 'getPersonaName').mockRejectedValue(
      new Error('timeout')
    )
    const { service, cache } = build()

    const { user } = await service.findMe('user-1')

    expect(user.steamId).toBe('12345')
    expect(user.steamPersonaName).toBeNull()
    expect(cache.set).toHaveBeenCalledWith(
      'steam:persona:12345',
      { name: null },
      60
    )
  })

  it('still answers when the cache is down', async () => {
    vi.spyOn(SteamApiService, 'getPersonaName').mockResolvedValue('Matheus')
    const { service } = build({
      cache: { get: vi.fn().mockRejectedValue(new Error('redis down')) }
    })

    const { user } = await service.findMe('user-1')

    expect(user.steamPersonaName).toBeNull()
  })

  it('does not call Steam when no account is linked', async () => {
    const getPersonaName = vi.spyOn(SteamApiService, 'getPersonaName')
    const { service } = build({ steamId: null })

    const { user } = await service.findMe('user-1')

    expect(user.steamPersonaName).toBeNull()
    expect(getPersonaName).not.toHaveBeenCalled()
  })
})

describe('UserService.delete', () => {
  function build(cacheSet: ReturnType<typeof vi.fn>) {
    const deleteUser = vi
      .fn()
      .mockResolvedValue({ id: 'user-1', userName: 'someone' })
    const service = new UserService(
      fakeUserRepository({
        findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
        deleteUser
      }),
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository(),
      undefined,
      { set: cacheSet } as unknown as CacheRepository
    )
    return { service, deleteUser }
  }

  it('revokes the sessions that were already issued and then deletes the account', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const { service, deleteUser } = build(set)

    const result = await service.delete('user-1')

    expect(set).toHaveBeenCalledWith(
      'sessions-revoked-at:user-1',
      expect.any(Number),
      expect.any(Number)
    )
    expect(deleteUser).toHaveBeenCalledWith('user-1')
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0]
    )
    expect(result).toEqual({ user: { id: 'user-1', userName: 'someone' } })
  })

  it('keeps the account when the revocation cannot be stored', async () => {
    const { service, deleteUser } = build(
      vi.fn().mockRejectedValue(new Error('redis down'))
    )

    await expect(service.delete('user-1')).rejects.toThrow('redis down')
    expect(deleteUser).not.toHaveBeenCalled()
  })
})
