import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { XboxApiError, XboxApiService } from './xbox-api.service'

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('OPENXBL_API_KEY', 'secret-key')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('XboxApiService.findProfile', () => {
  it('returns the person whose gamertag matches, ignoring case', async () => {
    fetchMock.mockResolvedValue(
      json({
        content: {
          people: [
            { xuid: '1', gamertag: 'Player One' },
            { xuid: '2', gamertag: 'Player' }
          ]
        }
      })
    )

    const result = await new XboxApiService().findProfile('player')

    expect(result).toEqual({ xuid: '2', gamertag: 'Player' })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://xbl.io/api/v2/search/player'
    )
    expect(fetchMock.mock.calls[0][1].headers['X-Authorization']).toBe(
      'secret-key'
    )
  })

  it('matches a modern gamertag typed with its suffix', async () => {
    fetchMock.mockResolvedValue(
      json({
        content: {
          people: [
            {
              xuid: '7',
              gamertag: 'Player1234',
              uniqueModernGamertag: 'Player#1234'
            }
          ]
        }
      })
    )

    const result = await new XboxApiService().findProfile('Player#1234')

    expect(result).toEqual({ xuid: '7', gamertag: 'Player1234' })
  })

  it('returns null when no result has the same gamertag', async () => {
    fetchMock.mockResolvedValue(
      json({ content: { people: [{ xuid: '1', gamertag: 'Player One' }] } })
    )

    expect(await new XboxApiService().findProfile('Player')).toBeNull()
  })

  it('throws XboxApiError carrying the upstream status', async () => {
    fetchMock.mockResolvedValue(json({ error: 'nope' }, 429))

    const error = await new XboxApiService()
      .findProfile('Player')
      .catch(err => err)

    expect(error).toBeInstanceOf(XboxApiError)
    expect(error.status).toBe(429)
    expect(error.message).not.toContain('secret-key')
  })

  it('throws XboxApiError without calling OpenXBL when the key is missing', async () => {
    vi.stubEnv('OPENXBL_API_KEY', '')

    await expect(
      new XboxApiService().findProfile('Player')
    ).rejects.toBeInstanceOf(XboxApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('wraps network failures in XboxApiError', async () => {
    fetchMock.mockRejectedValue(new Error('aborted'))

    await expect(
      new XboxApiService().findProfile('Player')
    ).rejects.toBeInstanceOf(XboxApiError)
  })
})

describe('XboxApiService.getUnlockedAchievements', () => {
  it('returns earned achievements with a real unlock date', async () => {
    fetchMock.mockResolvedValue(
      json({
        content: {
          achievements: [
            {
              progressState: 'Achieved',
              description: 'Kill Diablo.',
              progression: { timeUnlocked: '2016-12-29T03:00:00.000Z' }
            },
            {
              progressState: 'NotStarted',
              description: 'Reach level 70.',
              progression: { timeUnlocked: '0001-01-01T00:00:00.000Z' }
            },
            {
              progressState: 'Achieved',
              description: 'No date known.',
              progression: { timeUnlocked: '0001-01-01T00:00:00.000Z' }
            }
          ]
        }
      })
    )

    const result = await new XboxApiService().getUnlockedAchievements(
      '123',
      '2117764661'
    )

    expect(result).toEqual([
      {
        description: 'Kill Diablo.',
        unlockedAt: new Date('2016-12-29T03:00:00.000Z')
      }
    ])
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://xbl.io/api/v2/achievements/player/123/2117764661'
    )
  })
})

describe('XboxApiService.getTitleHistory', () => {
  it('maps titles and drops the ones that only ran on Win32', async () => {
    fetchMock.mockResolvedValue(
      json({
        content: {
          titles: [
            {
              titleId: '10',
              name: 'Halo 4',
              pfn: null,
              devices: ['Xbox360', 'XboxOne'],
              achievement: {
                progressPercentage: 100,
                currentAchievements: 49,
                totalAchievements: 49,
                currentGamerscore: 1000,
                totalGamerscore: 1000
              },
              titleHistory: { lastTimePlayed: '2025-06-30T02:44:56.000Z' }
            },
            {
              titleId: '20',
              name: 'Balatro',
              pfn: 'PlayStack.Balatro_3wcqaesafpzfy',
              devices: ['PC', 'XboxSeries']
            },
            { titleId: '30', name: 'Valorant', devices: ['Win32'] }
          ]
        }
      })
    )

    const result = await new XboxApiService().getTitleHistory('123')

    expect(result).toEqual([
      {
        titleId: '10',
        name: 'Halo 4',
        devices: ['Xbox360', 'XboxOne'],
        pfn: null,
        lastPlayedAt: new Date('2025-06-30T02:44:56.000Z'),
        achievementProgress: 100,
        achievementsEarned: 49,
        achievementsTotal: 49,
        gamerscoreEarned: 1000,
        gamerscoreTotal: 1000
      },
      {
        titleId: '20',
        name: 'Balatro',
        devices: ['PC', 'XboxSeries'],
        pfn: 'PlayStack.Balatro_3wcqaesafpzfy',
        lastPlayedAt: null,
        achievementProgress: 0,
        achievementsEarned: 0,
        achievementsTotal: 0,
        gamerscoreEarned: 0,
        gamerscoreTotal: 0
      }
    ])
  })
})

describe('XboxApiService.resolveProductIds', () => {
  it('looks each distinct pfn up once and skips the ones without a product', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('value=known')) {
        return json({ Products: [{ ProductId: '9ABC' }] })
      }
      if (url.includes('value=broken')) return json({}, 500)
      return json({ Products: [] })
    })

    const result = await new XboxApiService().resolveProductIds([
      'known',
      'known',
      'unknown',
      'broken'
    ])

    expect(result).toEqual(new Map([['known', '9ABC']]))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain(
      'alternateId=PackageFamilyName'
    )
  })
})

describe('XboxApiService.getMinutesPlayed', () => {
  it('posts the titles in one batch and keeps only stats that have a value', async () => {
    fetchMock.mockResolvedValue(
      json({
        content: {
          statlistscollection: [
            {
              stats: [
                { titleid: '10', name: 'MinutesPlayed', value: '166' },
                { titleid: '20', name: 'MinutesPlayed' }
              ]
            }
          ]
        }
      })
    )

    const result = await new XboxApiService().getMinutesPlayed('123', [
      '10',
      '20',
      '30'
    ])

    expect(result).toEqual(new Map([['10', 166]]))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://xbl.io/api/v2/player/stats')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      xuids: ['123'],
      stats: [
        { name: 'MinutesPlayed', titleId: '10' },
        { name: 'MinutesPlayed', titleId: '20' },
        { name: 'MinutesPlayed', titleId: '30' }
      ]
    })
  })

  it('splits more than 100 titles into several requests', async () => {
    fetchMock.mockResolvedValue(json({ content: { statlistscollection: [] } }))
    const titleIds = Array.from({ length: 101 }, (_, i) => String(i))

    await new XboxApiService().getMinutesPlayed('123', titleIds)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
