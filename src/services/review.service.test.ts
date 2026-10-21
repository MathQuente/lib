import { describe, it, expect, vi } from 'vitest'
import { ReviewService } from './review.service'
import { ReviewRepository } from '../repositories/review.repository'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
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

function fakeGameCacheService(
  overrides: Partial<GameCacheService> = {}
): GameCacheService {
  return {
    assertReleased: vi.fn().mockResolvedValue({ suggestsEndless: false }),
    ...overrides
  } as unknown as GameCacheService
}

type Stats = { hoursPlayed: number | null; completions: number } | null

function libraryEntry(
  id: number,
  status: string,
  endless = false,
  stats: Stats = null
) {
  return { endless, UserGamesStatus: { id, status }, UserGameStats: stats }
}

const STATUS_ERROR =
  'Você só pode escrever uma resenha de um jogo que já começou (Jogado, Jogando, Pausado ou Larguei) ou de um jogo na sua fila com horas ou finalizações registradas.'

function buildService({
  userGame,
  existing = null,
  upsert = vi.fn().mockResolvedValue({
    text: 'texto',
    updatedAt: new Date('2026-01-01')
  }) as unknown as ReviewRepository['upsert'],
  gameCacheService = fakeGameCacheService()
}: {
  userGame?: unknown
  existing?: unknown
  upsert?: ReviewRepository['upsert']
  gameCacheService?: GameCacheService
}) {
  const findUserGameStatus = vi.fn().mockResolvedValue(userGame ?? null)
  const service = new ReviewService(
    fakeReviewRepository({
      findByUserGame: vi.fn().mockResolvedValue(existing),
      upsert
    }),
    fakeUserRepository({ findUserGameStatus }),
    gameCacheService
  )
  return { service, upsert, findUserGameStatus }
}

describe('ReviewService.upsertReview', () => {
  it('throws 404 when the game is not in the library', async () => {
    const { service } = buildService({ userGame: null })

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Adicione o jogo à sua biblioteca para escrever uma resenha.'
    })
  })

  it('throws 400 when the game is not released yet, before checking status', async () => {
    const { service } = buildService({
      userGame: libraryEntry(4, 'BACKLOG'),
      gameCacheService: fakeGameCacheService({
        assertReleased: vi
          .fn()
          .mockRejectedValue(
            new ClientError('Este jogo ainda não foi lançado.', 400)
          )
      })
    })

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Este jogo ainda não foi lançado.'
    })
  })

  it.each([
    [
      'Backlog with 0 hours and 0 completions',
      libraryEntry(4, 'BACKLOG', false, { hoursPlayed: 0, completions: 0 })
    ],
    [
      'Backlog with null hours and 0 completions',
      libraryEntry(4, 'BACKLOG', false, { hoursPlayed: null, completions: 0 })
    ],
    ['Backlog without stats', libraryEntry(4, 'BACKLOG', false, null)],
    ['Wishlist without stats', libraryEntry(5, 'WISHLIST')],
    [
      'Wishlist with stored stats',
      libraryEntry(5, 'WISHLIST', false, { hoursPlayed: 108, completions: 4 })
    ]
  ])('throws 400 for %s', async (_label, userGame) => {
    const upsert = vi.fn()
    const { service } = buildService({ userGame, upsert })

    await expect(
      service.upsertReview(11133, 'user-1', 'texto')
    ).rejects.toMatchObject({ statusCode: 400, message: STATUS_ERROR })
    expect(upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['hours only', { hoursPlayed: 12.5, completions: 0 }],
    ['completions only', { hoursPlayed: 0, completions: 2 }],
    ['completions with null hours', { hoursPlayed: null, completions: 1 }],
    ['hours and completions', { hoursPlayed: 108, completions: 4 }]
  ])('creates the review for a Backlog game with %s', async (_label, stats) => {
    const { service, upsert } = buildService({
      userGame: libraryEntry(4, 'BACKLOG', false, stats)
    })

    await service.upsertReview(11133, 'user-1', 'texto')

    expect(upsert).toHaveBeenCalledWith('user-1', 11133, 'texto')
  })

  it.each([
    [1, 'PLAYED', false],
    [1, 'PLAYED', true],
    [2, 'PAUSED', false],
    [2, 'PAUSED', true],
    [3, 'PLAYING', false],
    [3, 'PLAYING', true],
    [6, 'DROPPED', false],
    [6, 'DROPPED', true]
  ])(
    'creates the review without a rating when %i/%s and endless=%s',
    async (id, status, endless) => {
      const { service, upsert } = buildService({
        userGame: libraryEntry(id, status, endless)
      })

      const result = await service.upsertReview(11133, 'user-1', 'texto')

      expect(upsert).toHaveBeenCalledWith('user-1', 11133, 'texto')
      expect(result.review.text).toBe('texto')
    }
  )

  it('allows editing an existing review without re-checking anything, even on the wishlist', async () => {
    const assertReleased = vi.fn()
    const { service, findUserGameStatus } = buildService({
      userGame: libraryEntry(5, 'WISHLIST'),
      existing: { text: 'texto antigo', updatedAt: new Date() },
      upsert: vi.fn().mockResolvedValue({
        text: 'texto editado',
        updatedAt: new Date('2026-01-02')
      }),
      gameCacheService: fakeGameCacheService({ assertReleased })
    })

    const result = await service.upsertReview(11133, 'user-1', 'texto editado')

    expect(findUserGameStatus).not.toHaveBeenCalled()
    expect(assertReleased).not.toHaveBeenCalled()
    expect(result.review.text).toBe('texto editado')
  })
})

describe('ReviewService.findCommunityReviews', () => {
  it('includes status and endless, null and false when the author left the library', async () => {
    const base = {
      userName: 'a',
      profilePicture: null,
      rating: null,
      hoursPlayed: 0,
      completions: 0,
      text: 'texto',
      createdAt: new Date('2026-01-01')
    }
    const service = new ReviewService(
      fakeReviewRepository({
        findCommunityReviews: vi.fn().mockResolvedValue([
          { ...base, userId: 'u1', status: 'PLAYING', endless: true },
          { ...base, userId: 'u2', status: null, endless: false }
        ]),
        countCommunityReviews: vi.fn().mockResolvedValue(2)
      }),
      fakeUserRepository(),
      fakeGameCacheService()
    )

    const { reviews } = await service.findCommunityReviews(11133, 0)

    expect(reviews[0]).toMatchObject({ status: 'PLAYING', endless: true })
    expect(reviews[1]).toMatchObject({ status: null, endless: false })
  })
})

describe('ReviewService.deleteReview', () => {
  it('throws when there is no review to delete', async () => {
    const service = new ReviewService(
      fakeReviewRepository({ findByUserGame: vi.fn().mockResolvedValue(null) }),
      fakeUserRepository(),
      fakeGameCacheService()
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
      fakeGameCacheService()
    )

    await service.deleteReview(11133, 'user-1')

    expect(deleteFn).toHaveBeenCalledWith('user-1', 11133)
  })
})
