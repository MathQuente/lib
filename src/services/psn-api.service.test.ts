import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getProfileFromUserName,
  getUserPlayedGames,
  getUserTrophiesForSpecificTitle
} from 'psn-api'
import {
  normalizeGameName,
  parseIsoDurationToMinutes,
  PsnApiError,
  PsnApiService
} from './psn-api.service'
import { PsnAuthService } from './psn-auth.service'

vi.mock('psn-api', () => ({
  getProfileFromUserName: vi.fn(),
  getUserPlayedGames: vi.fn(),
  getUserTitles: vi.fn(),
  getUserTrophiesForSpecificTitle: vi.fn()
}))

function fakeAuth() {
  return {
    getAuthorization: vi.fn().mockResolvedValue({ accessToken: 'token' }),
    invalidateAccessToken: vi.fn().mockResolvedValue(undefined)
  } as unknown as PsnAuthService & {
    getAuthorization: ReturnType<typeof vi.fn>
    invalidateAccessToken: ReturnType<typeof vi.fn>
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('parseIsoDurationToMinutes', () => {
  it.each([
    ['PT50H22M12S', 50 * 60 + 22],
    ['PT45M', 45],
    ['PT30S', 1],
    ['P1DT2H', 26 * 60],
    ['PT0S', 0],
    [undefined, 0],
    ['garbage', 0]
  ])('parses %s', (input, expected) => {
    expect(parseIsoDurationToMinutes(input)).toBe(expected)
  })
})

describe('normalizeGameName', () => {
  it('ignores trademark symbols, accents, case and punctuation', () => {
    expect(normalizeGameName('Tetris® Effect: Connected')).toBe(
      'tetris effect connected'
    )
    expect(normalizeGameName('Pokémon™')).toBe('pokemon')
  })
})

describe('PsnApiService.findProfile', () => {
  it('returns null when PSN says the user does not exist', async () => {
    vi.mocked(getProfileFromUserName).mockRejectedValue(
      new Error("User not found (user: 'ghost')")
    )

    const result = await new PsnApiService(fakeAuth()).findProfile('ghost')

    expect(result).toBeNull()
  })

  it('retries once with a fresh token when PSN rejects the token', async () => {
    const auth = fakeAuth()
    vi.mocked(getProfileFromUserName)
      .mockRejectedValueOnce(new Error('invalid token'))
      .mockResolvedValueOnce({
        profile: { accountId: '1', onlineId: 'someone' }
      } as never)

    const result = await new PsnApiService(auth).findProfile('someone')

    expect(auth.invalidateAccessToken).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ accountId: '1', onlineId: 'someone' })
  })
})

describe('PsnApiService.getPlayedGames', () => {
  it('paginates, drops non-game apps and normalizes fields', async () => {
    vi.mocked(getUserPlayedGames)
      .mockResolvedValueOnce({
        titles: [
          {
            titleId: 'CUSA1_00',
            name: 'Game One',
            category: 'ps4_game',
            concept: { id: 111 },
            playDuration: 'PT2H',
            lastPlayedDateTime: '2026-01-01T00:00:00Z'
          },
          {
            titleId: 'CUSA2_00',
            name: 'Netflix',
            category: 'ps4_videoservice_web_app',
            concept: { id: 222 },
            playDuration: 'PT10H'
          }
        ],
        nextOffset: 2,
        totalItemCount: 3
      } as never)
      .mockResolvedValueOnce({
        titles: [
          {
            titleId: 'PPSA3_00',
            name: 'Game Three',
            category: 'ps5_native_game',
            concept: { id: 333 },
            playDuration: 'PT30M'
          }
        ],
        totalItemCount: 3
      } as never)

    const games = await new PsnApiService(fakeAuth()).getPlayedGames('acc')

    expect(getUserPlayedGames).toHaveBeenCalledTimes(2)
    expect(games).toEqual([
      {
        titleId: 'CUSA1_00',
        conceptId: '111',
        name: 'Game One',
        playMinutes: 120,
        lastPlayedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        titleId: 'PPSA3_00',
        conceptId: '333',
        name: 'Game Three',
        playMinutes: 30,
        lastPlayedAt: null
      }
    ])
  })

  it('throws PsnApiError when PSN returns an error body', async () => {
    vi.mocked(getUserPlayedGames).mockResolvedValue({
      error: { message: 'Access denied' }
    } as never)

    await expect(
      new PsnApiService(fakeAuth()).getPlayedGames('acc')
    ).rejects.toBeInstanceOf(PsnApiError)
  })
})

describe('PsnApiService.getTrophySummariesByTitleId', () => {
  it('retries a failed batch one title at a time', async () => {
    const trophyTitle = {
      trophyTitleName: 'Good',
      progress: 100,
      earnedTrophies: { platinum: 1 },
      lastUpdatedDateTime: '2025-05-05T00:00:00Z'
    }
    vi.mocked(getUserTrophiesForSpecificTitle).mockImplementation(
      async (_auth, _account, { npTitleIds }) => {
        if (npTitleIds.includes(',')) {
          return { error: { message: 'Resource not found' } } as never
        }
        if (npTitleIds === 'BAD_00') {
          return { error: { message: 'Resource not found' } } as never
        }
        return {
          titles: [{ npTitleId: npTitleIds, trophyTitles: [trophyTitle] }]
        } as never
      }
    )

    const result = await new PsnApiService(
      fakeAuth()
    ).getTrophySummariesByTitleId('acc', ['GOOD_00', 'BAD_00'])

    expect(result.get('GOOD_00')).toEqual({
      progress: 100,
      hasPlatinum: true,
      lastTrophyAt: new Date('2025-05-05T00:00:00Z')
    })
    expect(result.has('BAD_00')).toBe(false)
  })
})
