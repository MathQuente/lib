import { describe, it, expect, vi } from 'vitest'
import { RatingService } from './rating.service'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
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

describe('RatingService.createRating', () => {
  it('throws ClientError when the user does not exist', async () => {
    const userRepository = fakeUserRepository({
      findUserById: vi.fn().mockResolvedValue(null)
    })
    const service = new RatingService(fakeRatingRepository(), userRepository)

    await expect(
      service.createRating(11133, 5, 'missing-user')
    ).rejects.toThrow(ClientError)
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
    const service = new RatingService(ratingRepository, userRepository)

    const result = await service.createRating(11133, 5, 'user-1')

    expect(addGameToUserLibrary).toHaveBeenCalledWith({
      igdbId: 11133,
      userId: 'user-1',
      statusIds: 1
    })
    expect(createUserGameStats).toHaveBeenCalledWith('user-1', 11133, 1)
    expect(result).toEqual({ rating: 5 })
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
    const service = new RatingService(ratingRepository, userRepository)

    await service.createRating(11133, 4, 'user-1')

    expect(updateGameStatus).not.toHaveBeenCalled()
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
    const service = new RatingService(ratingRepository, userRepository)

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
    const service = new RatingService(ratingRepository, userRepository)

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
    const service = new RatingService(ratingRepository, fakeUserRepository())

    const result = await service.findAverageRating(11133)

    expect(result).toEqual({ average: 0 })
  })

  it('returns the average when the game has ratings', async () => {
    const ratingRepository = fakeRatingRepository({
      findAverageRatingOfGame: vi
        .fn()
        .mockResolvedValue({ _avg: { value: 4.5 } })
    })
    const service = new RatingService(ratingRepository, fakeUserRepository())

    const result = await service.findAverageRating(11133)

    expect(result).toEqual({ average: 4.5 })
  })
})
