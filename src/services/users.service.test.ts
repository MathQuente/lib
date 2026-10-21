import { Prisma } from '@prisma/client'
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
  return {
    findUserGameStats: vi.fn().mockResolvedValue({ stats: null }),
    ...overrides
  } as unknown as UserRepository
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
    suggestsEndless: vi.fn().mockResolvedValue(false),
    assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: false }),
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
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 1022 })
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
      userId: 'user-1',
      endless: false
    })
    expect(result).toEqual({ igdbId: 1022 })
  })

  it('marks the game as endless when the cached modes suggest it', async () => {
    const addGameToUserLibrary = vi.fn().mockResolvedValue({ igdbId: 7 })
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary,
      createUserGameStats: vi.fn().mockResolvedValue(undefined)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService({
        suggestsEndless: vi.fn().mockResolvedValue(true)
      }),
      fakeFollowRepository()
    )

    await service.addGameToUserLibrary(7, 'user-1', 3)

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 7,
      statusIds: 3,
      userId: 'user-1',
      endless: true
    })
  })
})

describe('UserService.findUserGameStatus', () => {
  function build(found: unknown) {
    return new UserService(
      fakeUserRepository({
        findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
        findUserGameStatus: vi.fn().mockResolvedValue(found)
      }),
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )
  }

  it('returns the status, the endless mark and the totals', async () => {
    const service = build({
      endless: true,
      UserGamesStatus: { id: 4, status: 'BACKLOG' },
      UserGameStats: {
        hoursPlayed: new Prisma.Decimal('108.5'),
        completions: 4
      }
    })

    await expect(service.findUserGameStatus(7, 'user-1')).resolves.toEqual({
      userGameStatus: { id: 4, status: 'BACKLOG' },
      endless: true,
      hoursPlayed: 108.5,
      completions: 4
    })
  })

  it.each([
    [
      'without stats',
      {
        endless: false,
        UserGamesStatus: { id: 3, status: 'PLAYING' },
        UserGameStats: null
      }
    ],
    [
      'with null hours',
      {
        endless: false,
        UserGamesStatus: { id: 3, status: 'PLAYING' },
        UserGameStats: { hoursPlayed: null, completions: 0 }
      }
    ]
  ])('returns zero totals %s', async (_label, found) => {
    const service = build(found)

    await expect(
      service.findUserGameStatus(7, 'user-1')
    ).resolves.toMatchObject({
      hoursPlayed: 0,
      completions: 0
    })
  })

  it('returns null status and zero totals when the game is not in the library', async () => {
    const service = build(null)

    await expect(service.findUserGameStatus(7, 'user-1')).resolves.toEqual({
      userGameStatus: null,
      endless: false,
      hoursPlayed: 0,
      completions: 0
    })
  })
})

describe('UserService.setEndless', () => {
  it('toggles the flag for a game in the library', async () => {
    const setEndless = vi.fn().mockResolvedValue({ igdbId: 7, endless: true })
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ id: 'ug-7' }),
      setEndless
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    const result = await service.setEndless(7, 'user-1', true)

    expect(setEndless).toHaveBeenCalledWith(7, 'user-1', true)
    expect(result).toEqual({ igdbId: 7, endless: true })
  })

  it('throws 404 when the game is not in the library', async () => {
    const setEndless = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      setEndless
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await expect(service.setEndless(7, 'user-1', true)).rejects.toThrow(
      ClientError
    )
    expect(setEndless).not.toHaveBeenCalled()
  })
})

describe('UserService.setEndless race', () => {
  it('throws 404 when the game leaves the library between the check and the update', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ id: 'ug-7' }),
      setEndless: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test'
        })
      )
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )

    await expect(service.setEndless(7, 'user-1', true)).rejects.toMatchObject({
      statusCode: 404
    })
  })
})

describe('UserService.addGameToUserLibrary completions', () => {
  it.each([
    ['played', 1, 1],
    ['in the queue', 4, 0],
    ['on the wishlist', 5, 0]
  ])(
    'creates the stats with the right completions when added as %s',
    async (_label, statusId, expected) => {
      const createUserGameStats = vi
        .fn()
        .mockResolvedValue({ completions: expected })
      const userRepository = fakeUserRepository({
        findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
        findUserGame: vi.fn().mockResolvedValue(null),
        addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1022 }),
        createUserGameStats
      })
      const service = new UserService(
        userRepository,
        fakeRatingRepository(),
        fakeGameCacheService(),
        fakeFollowRepository()
      )

      await service.addGameToUserLibrary(1022, 'user-1', statusId)

      expect(createUserGameStats).toHaveBeenCalledWith('user-1', 1022, expected)
    }
  )
})

describe('UserService.updateGame keeps the completion history', () => {
  function serviceFor(currentStatus: number, completions: number) {
    const ensureAtLeastOneCompletion = vi
      .fn()
      .mockResolvedValue({ completions: Math.max(completions, 1) })
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({
        id: 'ug-1',
        UserGamesStatus: { id: currentStatus },
        _count: { platforms: 0 }
      }),
      updateGameStatus: vi
        .fn()
        .mockImplementation(async (igdbId, _u, statusId) => ({
          igdbId,
          UserGamesStatus: { id: statusId, status: 'X' }
        })),
      findUserGameStats: vi.fn().mockResolvedValue({ stats: { completions } }),
      ensureAtLeastOneCompletion
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )
    return { service, userRepository, ensureAtLeastOneCompletion }
  }

  it.each([
    ['playing', 3],
    ['dropped', 6],
    ['paused', 2]
  ])(
    'keeps the completions when a played game without platforms moves to %s',
    async (_label, statusId) => {
      const { service } = serviceFor(1, 2)

      const result = await service.updateGame(1, 'user-1', statusId)

      expect(result.playedCountUpdated).toBe(2)
    }
  )

  it('keeps a higher count when the game comes back to played', async () => {
    const { service, ensureAtLeastOneCompletion } = serviceFor(3, 2)

    const result = await service.updateGame(1, 'user-1', 1)

    expect(ensureAtLeastOneCompletion).toHaveBeenCalledWith('user-1', 1)
    expect(result.playedCountUpdated).toBe(2)
  })

  it('counts one completion when a game with none becomes played', async () => {
    const { service } = serviceFor(3, 0)

    const result = await service.updateGame(1, 'user-1', 1)

    expect(result.playedCountUpdated).toBe(1)
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
      service.findManyUserGames(
        'missing-user',
        0,
        undefined,
        undefined,
        'gameName',
        'asc'
      )
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

    await service.findManyUserGames(
      'user-1',
      2,
      'PLAYED',
      undefined,
      'rating',
      'desc'
    )

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

    await service.findManyUserGames(
      'user-1',
      0,
      undefined,
      undefined,
      'rating',
      'desc'
    )

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
        playedOn: [],
        endless: false
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
        playedOn: [],
        endless: false
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
        playedOn: [],
        endless: false
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
        playedOn: [],
        endless: false
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
        playedOn: [],
        endless: false
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
      countUserGames: vi.fn().mockResolvedValue({ _count: { userGames: 3 } }),
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
  function build(
    options: {
      steamId?: string | null
      cache?: Partial<CacheRepository>
    } = {}
  ) {
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

describe('UserService.updateUserGamePlayedCount', () => {
  function serviceFor(statusId: number, completions: number) {
    const updateUserGamePlayedCount = vi
      .fn()
      .mockImplementation(async (_u, _g, inc) => ({
        completions: completions + inc
      }))
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({
        UserGamesStatus: { id: statusId },
        _count: { platforms: 0 }
      }),
      findUserGameStats: vi.fn().mockResolvedValue({ stats: { completions } }),
      updateUserGamePlayedCount
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService(),
      fakeFollowRepository()
    )
    return { service, updateUserGamePlayedCount }
  }

  it('lets a game that is not played go down to zero completions', async () => {
    const { service } = serviceFor(3, 1)

    await expect(
      service.updateUserGamePlayedCount('user-1', 1, -1)
    ).resolves.toEqual({
      playedCount: 0
    })
  })

  it('does not go below zero', async () => {
    const { service, updateUserGamePlayedCount } = serviceFor(3, 0)

    await expect(
      service.updateUserGamePlayedCount('user-1', 1, -1)
    ).rejects.toThrow(ClientError)
    expect(updateUserGamePlayedCount).not.toHaveBeenCalled()
  })

  it('keeps at least one completion on a played game', async () => {
    const { service } = serviceFor(1, 1)

    await expect(
      service.updateUserGamePlayedCount('user-1', 1, -1)
    ).rejects.toThrow(ClientError)
  })

  it('adds a completion to a game being replayed', async () => {
    const { service } = serviceFor(3, 2)

    await expect(
      service.updateUserGamePlayedCount('user-1', 1, 1)
    ).resolves.toEqual({
      playedCount: 3
    })
  })
})
