import { describe, it, expect, vi } from 'vitest'
import { RatingService } from './rating.service'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { ClientError } from '../errors/client-error'

function fakeRatingRepository(
  overrides: Partial<RatingRepository> = {}
): RatingRepository {
  return { ...overrides } as unknown as RatingRepository
}

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return { ...overrides } as unknown as UserRepository
}

function fakeGameCacheService(
  overrides: Partial<GameCacheService> = {}
): GameCacheService {
  return {
    ensureCached: vi.fn().mockResolvedValue(true),
    assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: false }),
    cacheMany: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as GameCacheService
}

describe('RatingService.createRating', () => {
  it('throws ClientError when the user does not exist', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue(null)
    })
    const service = new RatingService(
      fakeRatingRepository(),
      userRepository,
      fakeGameCacheService()
    )

    await expect(
      service.createRating(11133, 5, 'missing-user')
    ).rejects.toThrow(ClientError)
  })

  it('throws ClientError when the igdbId is not a real IGDB game', async () => {
    const addGameToUserLibrary = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary
    })
    const gameCacheService = fakeGameCacheService({
      ensureCached: vi.fn().mockResolvedValue(false)
    })
    const service = new RatingService(
      fakeRatingRepository(),
      userRepository,
      gameCacheService
    )

    await expect(service.createRating(999999, 5, 'user-1')).rejects.toThrow(
      ClientError
    )
    expect(addGameToUserLibrary).not.toHaveBeenCalled()
  })

  it('adds the game to the library on first rating', async () => {
    const addGameToUserLibrary = vi.fn()
    const createUserGameStats = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary,
      createUserGameStats
    })
    const ratingRepository = fakeRatingRepository({
      create: vi.fn().mockResolvedValue({ value: 5 })
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    const result = await service.createRating(11133, 5, 'user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 11133,
      userId: 'user-1',
      statusIds: 1
    })
    expect(createUserGameStats).toHaveBeenCalledWith('user-1', 11133, 1)
    expect(result).toEqual({
      rating: 5,
      promotedToPlayed: true,
      addedAsPlaying: false
    })
  })

  it('adds an endless game as PLAYING with the flag, without counting a completion', async () => {
    const addGameToUserLibrary = vi.fn()
    const createUserGameStats = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue(null),
      addGameToUserLibrary,
      createUserGameStats
    })
    const service = new RatingService(
      fakeRatingRepository({
        create: vi.fn().mockResolvedValue({ value: 4 })
      }),
      userRepository,
      fakeGameCacheService({
        assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: true })
      })
    )

    const result = await service.createRating(11133, 4, 'user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 11133,
      userId: 'user-1',
      statusIds: 3,
      endless: true
    })
    expect(createUserGameStats).toHaveBeenCalledWith('user-1', 11133, 0)
    expect(result).toEqual({
      rating: 4,
      promotedToPlayed: false,
      addedAsPlaying: true
    })
  })

  it('moves an endless WISHLIST game to PLAYING with the flag on rating', async () => {
    const updateGameStatus = vi.fn()
    const updateUserGamePlayedCount = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 5 } }),
      updateGameStatus,
      updateUserGamePlayedCount
    })
    const service = new RatingService(
      fakeRatingRepository({
        create: vi.fn().mockResolvedValue({ value: 5 })
      }),
      userRepository,
      fakeGameCacheService({
        assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: true })
      })
    )

    const result = await service.createRating(11133, 5, 'user-1')

    expect(updateGameStatus).toHaveBeenCalledWith(11133, 'user-1', 3, {
      endless: true
    })
    expect(updateUserGamePlayedCount).not.toHaveBeenCalled()
    expect(result.addedAsPlaying).toBe(true)
    expect(result.promotedToPlayed).toBe(false)
  })

  it('clears a stale endless flag when the suggestion is now false and the row is unlocked', async () => {
    const updateGameStatus = vi.fn()
    const updateUserGamePlayedCount = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({
        UserGamesStatus: { id: 5 },
        endless: true,
        endlessLocked: false
      }),
      updateGameStatus,
      updateUserGamePlayedCount
    })
    const service = new RatingService(
      fakeRatingRepository({
        create: vi.fn().mockResolvedValue({ value: 5 })
      }),
      userRepository,
      fakeGameCacheService()
    )

    const result = await service.createRating(11133, 5, 'user-1')

    expect(updateGameStatus).toHaveBeenCalledWith(11133, 'user-1', 1, {
      endless: false
    })
    expect(updateUserGamePlayedCount).toHaveBeenCalledWith('user-1', 11133, 1)
    expect(result.promotedToPlayed).toBe(true)
  })

  it('keeps the manual choice of a locked WISHLIST game instead of the suggestion', async () => {
    const updateGameStatus = vi.fn()
    const updateUserGamePlayedCount = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({
        UserGamesStatus: { id: 5 },
        endless: false,
        endlessLocked: true
      }),
      updateGameStatus,
      updateUserGamePlayedCount
    })
    const service = new RatingService(
      fakeRatingRepository({
        create: vi.fn().mockResolvedValue({ value: 5 })
      }),
      userRepository,
      fakeGameCacheService({
        assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: true })
      })
    )

    const result = await service.createRating(11133, 5, 'user-1')

    expect(updateGameStatus).toHaveBeenCalledWith(11133, 'user-1', 1, {
      endless: false
    })
    expect(result.promotedToPlayed).toBe(true)
    expect(result.addedAsPlaying).toBe(false)
  })

  it('does not touch the library when the game is already marked PLAYED', async () => {
    const updateGameStatus = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 1 } }),
      updateGameStatus
    })
    const ratingRepository = fakeRatingRepository({
      create: vi.fn().mockResolvedValue({ value: 4 })
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    const result = await service.createRating(11133, 4, 'user-1')

    expect(updateGameStatus).not.toHaveBeenCalled()
    expect(result.promotedToPlayed).toBe(false)
  })

  it('promotes WISHLIST to PLAYED on rating', async () => {
    const updateGameStatus = vi.fn()
    const updateUserGamePlayedCount = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 5 } }),
      updateGameStatus,
      updateUserGamePlayedCount
    })
    const ratingRepository = fakeRatingRepository({
      create: vi.fn().mockResolvedValue({ value: 5 })
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    const result = await service.createRating(11133, 5, 'user-1')

    expect(updateGameStatus).toHaveBeenCalledWith(11133, 'user-1', 1, {
      endless: false
    })
    expect(updateUserGamePlayedCount).toHaveBeenCalledWith('user-1', 11133, 1)
    expect(result.promotedToPlayed).toBe(true)
  })

  it('does not promote PLAYING/BACKLOG/PAUSED — only saves the rating', async () => {
    const updateGameStatus = vi.fn()
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findUserGame: vi.fn().mockResolvedValue({ UserGamesStatus: { id: 3 } }),
      updateGameStatus
    })
    const ratingRepository = fakeRatingRepository({
      create: vi.fn().mockResolvedValue({ value: 4 })
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    const result = await service.createRating(11133, 4, 'user-1')

    expect(updateGameStatus).not.toHaveBeenCalled()
    expect(result).toEqual({
      rating: 4,
      promotedToPlayed: false,
      addedAsPlaying: false
    })
  })

  it('throws ClientError when the game has not been released yet', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' })
    })
    const gameCacheService = fakeGameCacheService({
      assertReleased: vi
        .fn()
        .mockRejectedValue(new ClientError('Este jogo ainda não foi lançado.', 400))
    })
    const ratingRepository = fakeRatingRepository({
      create: vi.fn()
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      gameCacheService
    )

    await expect(service.createRating(11133, 5, 'user-1')).rejects.toThrow(
      ClientError
    )
    expect(ratingRepository.create).not.toHaveBeenCalled()
  })
})

describe('RatingService.deleteRating', () => {
  it('throws ClientError when there is no rating to delete', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue(null)
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    await expect(service.deleteRating(11133, 'user-1')).rejects.toThrow(
      ClientError
    )
  })

  it('deletes the rating when it exists', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined)
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue({ id: 'user-1' })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue({ value: 3 }),
      delete: deleteFn
    })
    const service = new RatingService(
      ratingRepository,
      userRepository,
      fakeGameCacheService()
    )

    await service.deleteRating(11133, 'user-1')

    expect(deleteFn).toHaveBeenCalledWith(11133, 'user-1')
  })
})

describe('RatingService.findAverageRating', () => {
  it('returns 0 when the game has no ratings', async () => {
    const ratingRepository = fakeRatingRepository({
      findAverageRatingOfGame: vi
        .fn()
        .mockResolvedValue({ _avg: { value: null } })
    })
    const service = new RatingService(
      ratingRepository,
      fakeUserRepository(),
      fakeGameCacheService()
    )

    const result = await service.findAverageRating(11133)

    expect(result).toEqual({ average: 0 })
  })

  it('returns the average when the game has ratings', async () => {
    const ratingRepository = fakeRatingRepository({
      findAverageRatingOfGame: vi
        .fn()
        .mockResolvedValue({ _avg: { value: 4.5 } })
    })
    const service = new RatingService(
      ratingRepository,
      fakeUserRepository(),
      fakeGameCacheService()
    )

    const result = await service.findAverageRating(11133)

    expect(result).toEqual({ average: 4.5 })
  })
})
