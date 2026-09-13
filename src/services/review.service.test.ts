import { describe, it, expect, vi } from 'vitest'
import { ReviewService } from './review.service'
import { ReviewRepository } from '../repositories/review.repository'
import { UserRepository } from '../repositories/users.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { ClientError } from '../errors/client-error'

function fakeReviewRepository(
  overrides: Partial<ReviewRepository> = {}
): ReviewRepository {
  return { ...overrides } as unknown as ReviewRepository
}

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return {
    findUserById: vi.fn().mockResolvedValue({ id: 'user-1' }),
    ...overrides
  } as unknown as UserRepository
}

function fakeRatingRepository(
  overrides: Partial<RatingRepository> = {}
): RatingRepository {
  return { ...overrides } as unknown as RatingRepository
}

describe('ReviewService.upsertReview', () => {
  it('throws when the game is not in the library', async () => {
    const userRepository = fakeUserRepository({
      findUserGameStatus: vi.fn().mockResolvedValue(null)
    })
    const service = new ReviewService(
      fakeReviewRepository({ findByUserGame: vi.fn().mockResolvedValue(null) }),
      userRepository,
      fakeRatingRepository()
    )

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toThrow(ClientError)
  })

  it('throws when the game is not marked PLAYED', async () => {
    const userRepository = fakeUserRepository({
      findUserGameStatus: vi
        .fn()
        .mockResolvedValue({ UserGamesStatus: { id: 3, status: 'PLAYING' } })
    })
    const service = new ReviewService(
      fakeReviewRepository({ findByUserGame: vi.fn().mockResolvedValue(null) }),
      userRepository,
      fakeRatingRepository()
    )

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toThrow(ClientError)
  })

  it('throws when there is no rating yet', async () => {
    const userRepository = fakeUserRepository({
      findUserGameStatus: vi
        .fn()
        .mockResolvedValue({ UserGamesStatus: { id: 1, status: 'PLAYED' } })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue(null)
    })
    const service = new ReviewService(
      fakeReviewRepository({ findByUserGame: vi.fn().mockResolvedValue(null) }),
      userRepository,
      ratingRepository
    )

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toThrow(ClientError)
  })

  it('creates the review when PLAYED and rated', async () => {
    const upsert = vi.fn().mockResolvedValue({
      text: 'texto',
      updatedAt: new Date('2026-01-01')
    })
    const userRepository = fakeUserRepository({
      findUserGameStatus: vi
        .fn()
        .mockResolvedValue({ UserGamesStatus: { id: 1, status: 'PLAYED' } })
    })
    const ratingRepository = fakeRatingRepository({
      findUniqueByUserGame: vi.fn().mockResolvedValue({ value: 5 })
    })
    const service = new ReviewService(
      fakeReviewRepository({
        findByUserGame: vi.fn().mockResolvedValue(null),
        upsert
      }),
      userRepository,
      ratingRepository
    )

    const result = await service.upsertReview(11133, 'user-1', 'texto')

    expect(upsert).toHaveBeenCalledWith('user-1', 11133, 'texto')
    expect(result.review.text).toBe('texto')
  })

  it('allows editing an existing review without re-checking status/rating', async () => {
    const upsert = vi.fn().mockResolvedValue({
      text: 'texto editado',
      updatedAt: new Date('2026-01-02')
    })
    const findUserGameStatus = vi.fn()
    const userRepository = fakeUserRepository({ findUserGameStatus })
    const service = new ReviewService(
      fakeReviewRepository({
        findByUserGame: vi
          .fn()
          .mockResolvedValue({ text: 'texto antigo', updatedAt: new Date() }),
        upsert
      }),
      userRepository,
      fakeRatingRepository()
    )

    const result = await service.upsertReview(11133, 'user-1', 'texto editado')

    expect(findUserGameStatus).not.toHaveBeenCalled()
    expect(result.review.text).toBe('texto editado')
  })
})

describe('ReviewService.deleteReview', () => {
  it('throws when there is no review to delete', async () => {
    const service = new ReviewService(
      fakeReviewRepository({ findByUserGame: vi.fn().mockResolvedValue(null) }),
      fakeUserRepository(),
      fakeRatingRepository()
    )

    await expect(service.deleteReview(11133, 'user-1')).rejects.toThrow(
      ClientError
    )
  })

  it('deletes the review when it exists', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined)
    const service = new ReviewService(
      fakeReviewRepository({
        findByUserGame: vi.fn().mockResolvedValue({ text: 'texto' }),
        delete: deleteFn
      }),
      fakeUserRepository(),
      fakeRatingRepository()
    )

    await service.deleteReview(11133, 'user-1')

    expect(deleteFn).toHaveBeenCalledWith('user-1', 11133)
  })
})
