import { describe, it, expect, vi } from 'vitest'
import { UserService } from './users.service'
import { IGDBService } from './igdb.service'
import { GameCacheService } from './game-cache.service'
import { UserRepository } from '../repositories/users.repository'
import { PaginatedUserGameRow } from '../types/user'
import { RatingRepository } from '../repositories/rating.repository'
import { ClientError } from '../errors/client-error'

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
  const all = ['PLAYED', 'PLAYING', 'PAUSED', 'BACKLOG', 'WISHLIST']
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
      gameCacheService
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
      gameCacheService
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
      fakeGameCacheService()
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
      fakeGameCacheService()
    )

    await service.findManyUserGames('user-1', 2, 'PLAYED', undefined, 'rating', 'desc')

    expect(findManyGamesOfUser).toHaveBeenCalledWith({
      userId: 'user-1',
      filter: 'PLAYED',
      query: undefined,
      sortBy: 'rating',
      sortOrder: 'desc',
      skip: 60,
      take: 30
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
      fakeGameCacheService()
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
        hoursPlayed: 0
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
        hoursPlayed: 0
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
      fakeGameCacheService()
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
        hoursPlayed: 0
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
        hoursPlayed: 0
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
      fakeGameCacheService()
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
        hoursPlayed: 0
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
      fakeGameCacheService()
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
      fakeGameCacheService()
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
      fakeGameCacheService()
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
      fakeGameCacheService()
    )

    await service.updateGame(11133, 'user-1', 4)

    expect(findUniqueByUserGame).not.toHaveBeenCalled()
  })
})

describe('UserService.findById', () => {
  it('returns the full profile, without steamId, when the user is public', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        userName: 'matheus',
        profilePicture: 'pic.png',
        userBanner: 'banner.png',
        steamId: '12345',
        isPublic: true,
        _count: { userGames: 3 }
      }),
      countUserGames: vi
        .fn()
        .mockResolvedValue({ _count: { userGames: 3 } }),
      sumUserHoursPlayed: vi.fn().mockResolvedValue(12.5)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService()
    )

    const { user } = await service.findById('user-1')

    expect(user).toEqual({
      id: 'user-1',
      profilePicture: 'pic.png',
      userBanner: 'banner.png',
      userName: 'matheus',
      gamesAmount: 3,
      totalHoursPlayed: 12.5,
      isPublic: true
    })
    expect(user).not.toHaveProperty('steamId')
  })

  it('returns avatar/banner/username but not game counts when the user is private', async () => {
    const countUserGames = vi.fn()
    const sumUserHoursPlayed = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        userName: 'matheus',
        profilePicture: 'pic.png',
        userBanner: 'banner.png',
        steamId: '12345',
        isPublic: false,
        _count: { userGames: 3 }
      }),
      countUserGames,
      sumUserHoursPlayed
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService()
    )

    const { user } = await service.findById('user-1')

    expect(user).toEqual({
      id: 'user-1',
      profilePicture: 'pic.png',
      userBanner: 'banner.png',
      userName: 'matheus',
      isPublic: false
    })
    expect(user).not.toHaveProperty('gamesAmount')
    expect(user).not.toHaveProperty('totalHoursPlayed')
    expect(countUserGames).not.toHaveBeenCalled()
    expect(sumUserHoursPlayed).not.toHaveBeenCalled()
  })
})

describe('UserService.findMe', () => {
  it('returns the full self profile, including steamId and isPublic', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({
        id: 'user-1',
        userName: 'matheus',
        profilePicture: 'pic.png',
        userBanner: 'banner.png',
        steamId: '12345',
        isPublic: false,
        _count: { userGames: 3 }
      }),
      sumUserHoursPlayed: vi.fn().mockResolvedValue(12.5)
    })
    const service = new UserService(
      userRepository,
      fakeRatingRepository(),
      fakeGameCacheService()
    )

    const { user } = await service.findMe('user-1')

    expect(user).toEqual({
      id: 'user-1',
      profilePicture: 'pic.png',
      userBanner: 'banner.png',
      userName: 'matheus',
      gamesAmount: 3,
      totalHoursPlayed: 12.5,
      steamId: '12345',
      isPublic: false
    })
  })
})
