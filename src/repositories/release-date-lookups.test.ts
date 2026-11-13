import { afterEach, describe, it, expect, vi } from 'vitest'
import { prisma } from '../database/db'
import { UserRepository } from './users.repository'
import { RatingRepository } from './rating.repository'
import { ReviewRepository } from './review.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('UserRepository.findLibraryStatusesOutsideWishlist', () => {
  it('sums users and collects statuses per game, leaving the wishlist out of the query', async () => {
    const groupBy = vi.spyOn(prisma.userGame, 'groupBy').mockResolvedValue([
      { igdbId: 10, userGamesStatusId: 1, _count: { _all: 2 } },
      { igdbId: 10, userGamesStatusId: 4, _count: { _all: 1 } },
      { igdbId: 11, userGamesStatusId: 3, _count: { _all: 1 } }
    ] as never)

    const result =
      await new UserRepository().findLibraryStatusesOutsideWishlist([
        10, 11, 12
      ])

    expect(result.get(10)).toEqual({ users: 3, statusIds: [1, 4] })
    expect(result.get(11)).toEqual({ users: 1, statusIds: [3] })
    expect(result.has(12)).toBe(false)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          igdbId: { in: [10, 11, 12] },
          userGamesStatusId: { not: 5 }
        }
      })
    )
  })

  it('splits a long list into blocks so the query never exceeds the parameter limit', async () => {
    const groupBy = vi
      .spyOn(prisma.userGame, 'groupBy')
      .mockResolvedValue([] as never)

    await new UserRepository().findLibraryStatusesOutsideWishlist(ids(12_000))

    expect(groupBy).toHaveBeenCalledTimes(3)
  })
})

describe('rating and review lookups for a list of games', () => {
  it('RatingRepository returns the games that have a rating, in blocks', async () => {
    const findMany = vi
      .spyOn(prisma.rating, 'findMany')
      .mockResolvedValueOnce([{ igdbId: 1 }] as never)
      .mockResolvedValueOnce([{ igdbId: 5001 }] as never)

    const found = await new RatingRepository().findIgdbIdsWithRatings(ids(6000))

    expect(findMany).toHaveBeenCalledTimes(2)
    expect([...found].sort((a, b) => a - b)).toEqual([1, 5001])
  })

  it('ReviewRepository returns the games that have a review, in blocks', async () => {
    const findMany = vi
      .spyOn(prisma.review, 'findMany')
      .mockResolvedValueOnce([{ igdbId: 2 }] as never)
      .mockResolvedValueOnce([] as never)

    const found = await new ReviewRepository().findIgdbIdsWithReviews(ids(6000))

    expect(findMany).toHaveBeenCalledTimes(2)
    expect([...found]).toEqual([2])
  })

  it('both return an empty set without querying when there are no ids', async () => {
    const ratings = vi.spyOn(prisma.rating, 'findMany')
    const reviews = vi.spyOn(prisma.review, 'findMany')

    expect((await new RatingRepository().findIgdbIdsWithRatings([])).size).toBe(
      0
    )
    expect((await new ReviewRepository().findIgdbIdsWithReviews([])).size).toBe(
      0
    )
    expect(ratings).not.toHaveBeenCalled()
    expect(reviews).not.toHaveBeenCalled()
  })
})
