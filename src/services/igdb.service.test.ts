import { describe, it, expect, vi, afterEach } from 'vitest'
import { EROTIC_EXCEPTION_IDS, IGDBService } from './igdb.service'
import { IGDBGame } from '../types/igdb'

type RequestFn = (endpoint: string, body: string) => Promise<unknown>

function mockRequest(rows: Record<string, unknown>[]) {
  return vi
    .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
    .mockResolvedValue(rows)
}

function game(id: number): IGDBGame {
  return { id, name: `Game ${id}` } as IGDBGame
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IGDBService.getGamesByExternalIds', () => {
  it('returns empty without calling IGDB when no uids are given', async () => {
    const request = mockRequest([])

    const result = await IGDBService.getGamesByExternalIds([], 36)

    expect(result).toEqual([])
    expect(request).not.toHaveBeenCalled()
  })

  it('filters external_games by the given source and maps uid to game', async () => {
    const request = mockRequest([
      { uid: '205023', game: 10 },
      { uid: '233449', game: 20 }
    ])
    vi.spyOn(IGDBService, 'getGamesByIds').mockResolvedValue([game(10), game(20)])

    const result = await IGDBService.getGamesByExternalIds(['205023', '233449'], 36)

    expect(request).toHaveBeenCalledWith(
      'external_games',
      expect.stringContaining(
        'where uid = ("205023","233449") & external_game_source = 36;'
      )
    )
    expect(result).toEqual([
      { uid: '205023', game: game(10) },
      { uid: '233449', game: game(20) }
    ])
  })

  it('fetches each IGDB game once when several uids point to it', async () => {
    mockRequest([
      { uid: '1', game: 10 },
      { uid: '2', game: 10 }
    ])
    const getGamesByIds = vi
      .spyOn(IGDBService, 'getGamesByIds')
      .mockResolvedValue([game(10)])

    const result = await IGDBService.getGamesByExternalIds(['1', '2'], 36)

    expect(getGamesByIds).toHaveBeenCalledWith([10])
    expect(result).toHaveLength(2)
  })

  it('drops uids whose IGDB game could not be fetched', async () => {
    mockRequest([
      { uid: '1', game: 10 },
      { uid: '2', game: 99 }
    ])
    vi.spyOn(IGDBService, 'getGamesByIds').mockResolvedValue([game(10)])

    const result = await IGDBService.getGamesByExternalIds(['1', '2'], 36)

    expect(result).toEqual([{ uid: '1', game: game(10) }])
  })
})

describe('IGDBService.getGamesBySteamAppIds', () => {
  it('delegates to the Steam source and converts uids back to numbers', async () => {
    const getGamesByExternalIds = vi
      .spyOn(IGDBService, 'getGamesByExternalIds')
      .mockResolvedValue([{ uid: '440', game: game(10) }])

    const result = await IGDBService.getGamesBySteamAppIds([440])

    expect(getGamesByExternalIds).toHaveBeenCalledWith(
      ['440'],
      IGDBService.STEAM_EXTERNAL_GAME_SOURCE
    )
    expect(result).toEqual([{ appId: 440, game: game(10) }])
  })
})

describe('IGDBService.searchGamesByName', () => {
  it('searches the cleaned name restricted to the given platforms', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([game(1)])

    const result = await IGDBService.searchGamesByName('Far Cry® 4 "GOTY";', [12, 49])

    expect(result).toEqual([game(1)])
    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringMatching(
        /^search "Far Cry 4 GOTY"; .*where platforms = \(12,49\); limit 10;$/
      )
    )
  })

  it('returns empty without calling IGDB when nothing is left to search', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([])

    expect(await IGDBService.searchGamesByName('™', [12])).toEqual([])
    expect(request).not.toHaveBeenCalled()
  })
})

describe('IGDBService.getTimeToBeatByGameIds', () => {
  it('returns empty without calling IGDB when no ids are given', async () => {
    const request = mockRequest([])

    const result = await IGDBService.getTimeToBeatByGameIds([])

    expect(result.size).toBe(0)
    expect(request).not.toHaveBeenCalled()
  })

  it('maps game ids to the normal time to beat and ignores rows without one', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([
        { game_id: 10, normally: 36000 },
        { game_id: 20 },
        { game_id: 30, normally: 0 }
      ])

    const result = await IGDBService.getTimeToBeatByGameIds([10, 20, 30, 10])

    expect(request).toHaveBeenCalledWith(
      'game_time_to_beats',
      expect.stringContaining('where game_id = (10,20,30);')
    )
    expect([...result]).toEqual([[10, 36000]])
  })

  it('splits large id lists into batches of 500', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([])

    await IGDBService.getTimeToBeatByGameIds(
      Array.from({ length: 501 }, (_, i) => i + 1)
    )

    expect(request).toHaveBeenCalledTimes(2)
  })
})

describe('IGDBService.getGameTypesByIds', () => {
  it('returns empty without calling IGDB when no ids are given', async () => {
    const request = mockRequest([])

    const result = await IGDBService.getGameTypesByIds([])

    expect(result.size).toBe(0)
    expect(request).not.toHaveBeenCalled()
  })

  it('maps game ids to their game type and ignores rows without one', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([
        { id: 3182, game_type: 2 },
        { id: 232, game_type: 4 },
        { id: 9 }
      ])

    const result = await IGDBService.getGameTypesByIds([3182, 232, 9, 3182])

    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('where id = (3182,232,9);')
    )
    expect([...result]).toEqual([
      [3182, 2],
      [232, 4]
    ])
  })

  it('splits large id lists into batches of 500', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([])

    await IGDBService.getGameTypesByIds(
      Array.from({ length: 501 }, (_, i) => i + 1)
    )

    expect(request).toHaveBeenCalledTimes(2)
  })
})

describe('IGDBService.suggestsEndless', () => {
  it.each([
    [[], false],
    [[1], false],
    [[1, 2], false],
    [[1, 2, 3, 4], false],
    [[2], true],
    [[2, 3], false],
    [[2, 3, 4], false],
    [[3], false],
    [[2, 4], true],
    [[2, 3, 5], true],
    [[5], true],
    [[6], true],
    [[1, 5], true],
    [[1, 2, 6], true]
  ])('modes %j -> %s', (gameModes, expected) => {
    expect(IGDBService.suggestsEndless({ gameModes, name: 'Some Game' })).toBe(
      expected
    )
  })

  it('suggests endless for a known franchise even with single player and no modes', () => {
    expect(
      IGDBService.suggestsEndless({
        gameModes: [1, 2, 3],
        name: 'EA Sports FC 26'
      })
    ).toBe(true)
    expect(
      IGDBService.suggestsEndless({
        gameModes: [],
        name: 'EA Sports FC 27: Ultimate Plus Edition'
      })
    ).toBe(true)
  })
})

describe('IGDBService.isEndlessFranchise', () => {
  it.each([
    'EA Sports FC 24',
    'EA Sports FC 26: Icons Edition',
    'EA Sports FC 27',
    'FIFA 15',
    'EA Sports FIFA 18',
    'FIFA 23',
    'NBA 2K15',
    'NBA 2K26',
    'Madden NFL 16',
    'Madden NFL 26',
    'EA Sports Madden NFL 25: Deluxe Edition',
    'NHL 16',
    'NHL 26',
    'NBA 2K30',
    'Madden NFL 30',
    'NHL 30'
  ])('matches %s', name => {
    expect(IGDBService.isEndlessFranchise(name)).toBe(true)
  })

  it.each([
    'FC 26 Quiz',
    'FIFA 14',
    'FIFA 24',
    'NHL 94',
    'NHL 15',
    'Madden NFL 15',
    'NBA 2K14',
    'EA Sports FIFA 18 & NHL 18 Bundle',
    'EA Sports FIFA 18 and Need for Speed Payback Bundle',
    'Elden Ring',
    'Valorant'
  ])('does not match %s', name => {
    expect(IGDBService.isEndlessFranchise(name)).toBe(false)
  })
})

describe('IGDBService.toGameCacheInput', () => {
  it('keeps the numeric game mode ids', () => {
    const input = IGDBService.toGameCacheInput({
      id: 1,
      name: 'Valorant',
      game_modes: [{ id: 2, name: 'Multiplayer' }, { id: 6, name: 'Battle Royale' }]
    } as IGDBGame)

    expect(input.gameModes).toEqual([2, 6])
  })

  it('returns an empty list when the modes are missing or have no id', () => {
    expect(
      IGDBService.toGameCacheInput({ id: 1, name: 'A' } as IGDBGame).gameModes
    ).toEqual([])
    expect(
      IGDBService.toGameCacheInput({
        id: 2,
        name: 'B',
        game_modes: [{ name: 'Multiplayer' }]
      } as IGDBGame).gameModes
    ).toEqual([])
  })
})

describe('IGDBService.getGameStatusByIds', () => {
  it('returns an empty map without calling IGDB when no ids are given', async () => {
    const request = mockRequest([])

    expect((await IGDBService.getGameStatusByIds([])).size).toBe(0)
    expect(request).not.toHaveBeenCalled()
  })

  it('maps the status id and uses null when IGDB omits the field', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValue([
        { id: 288169, game_status: 7 },
        { id: 81249 }
      ])

    const result = await IGDBService.getGameStatusByIds([288169, 81249])

    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('where id = (288169,81249); fields id,game_status;')
    )
    expect(result.get(288169)).toBe(7)
    expect(result.get(81249)).toBeNull()
  })
})

describe('IGDBService status in the cache input and listings', () => {
  it('keeps the game status in the cache input, null when missing', () => {
    expect(
      IGDBService.toGameCacheInput({ id: 1, name: 'A', game_status: 7 } as IGDBGame)
        .gameStatus
    ).toBe(7)
    expect(
      IGDBService.toGameCacheInput({ id: 2, name: 'B' } as IGDBGame).gameStatus
    ).toBeNull()
  })

  describe('keeps the Erotic theme (42) out of the catalog', () => {
    const EXCLUDE_EROTIC = 'themes != (42)'
    const EXCEPTION_LIST = EROTIC_EXCEPTION_IDS.join(',')

    it.each([
      ['fetchForSync', () => IGDBService.fetchForSync(0, 500)],
      [
        'fetchMissingReleasedContent',
        () => IGDBService.fetchMissingReleasedContent(0, 1000, 500)
      ],
      ['getRecentlyReleasedGames', () => IGDBService.getRecentlyReleasedGames()]
    ])('%s filters the theme', async (_name, call) => {
      const request = mockRequest([])

      await call()

      expect(request).toHaveBeenCalledWith(
        'games',
        expect.stringContaining(EXCLUDE_EROTIC)
      )
    })

    it('filters the theme in the coming soon list and in its count', async () => {
      const request = mockRequest([])
      const count = vi
        .spyOn(
          IGDBService as unknown as { countRequest: RequestFn },
          'countRequest'
        )
        .mockResolvedValue(0 as never)

      await IGDBService.getComingSoonGames(20, 0)

      expect(request).toHaveBeenCalledWith(
        'games',
        expect.stringContaining(EXCLUDE_EROTIC)
      )
      expect(count).toHaveBeenCalledWith(
        'games',
        expect.stringContaining(EXCLUDE_EROTIC)
      )
    })

    it('lists the ids of Erotic games in pages for the purge script', async () => {
      const request = mockRequest([{ id: 11 }, { id: 15 }])

      const ids = await IGDBService.fetchEroticIds(10, 500)

      expect(ids).toEqual([11, 15])
      expect(request).toHaveBeenCalledWith(
        'games',
        `fields id; where id > 10 & themes = (42) & id != (${EXCEPTION_LIST}); sort id asc; limit 500;`
      )
    })

    it('blocks a tagged game outside the exception list and lets a listed one through', async () => {
      const request = mockRequest([])

      await IGDBService.fetchForSync(0, 500)

      const query = request.mock.calls[0][1] as string
      expect(query).toContain(
        `(themes != (42) | id = (${EXCEPTION_LIST}))`
      )
      expect(EROTIC_EXCEPTION_IDS).toContain(12328)
      expect(EROTIC_EXCEPTION_IDS).not.toContain(1)
      expect(query).not.toMatch(/ & themes != \(42\)/)
    })

    it('keeps the exception list sorted, unique and with every approved game', () => {
      expect([...EROTIC_EXCEPTION_IDS].sort((a, b) => a - b)).toEqual(
        EROTIC_EXCEPTION_IDS
      )
      expect(new Set(EROTIC_EXCEPTION_IDS).size).toBe(EROTIC_EXCEPTION_IDS.length)
      expect(EROTIC_EXCEPTION_IDS).toHaveLength(22)
    })

    it('does not filter the title matcher used by the platform imports', async () => {
      const request = mockRequest([])

      await IGDBService.searchGamesByName('zelda', [6])

      expect(request).toHaveBeenCalledWith(
        'games',
        expect.not.stringContaining(EXCLUDE_EROTIC)
      )
    })
  })

  it('asks IGDB for game_status when syncing', async () => {
    const request = mockRequest([])

    await IGDBService.fetchForSync(0, 500)

    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('parent_game,game_status;')
    )
  })

  it('leaves rumored games out of the coming soon list and its count', async () => {
    const request = mockRequest([])
    const count = vi
      .spyOn(IGDBService as unknown as { countRequest: RequestFn }, 'countRequest')
      .mockResolvedValue(0 as never)

    await IGDBService.getComingSoonGames(20, 0)

    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('& game_status != 7;')
    )
    expect(count).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('& game_status != 7;')
    )
  })
})

describe('IGDBService lookups that feed games_cache', () => {
  it.each([
    ['getGameById', () => IGDBService.getGameById(1)],
    ['getGamesByIds', () => IGDBService.getGamesByIds([1])],
    ['searchGamesByName', () => IGDBService.searchGamesByName('zelda', [6])]
  ])('%s requests game_status', async (_name, call) => {
    const request = mockRequest([])

    await call()

    expect(request).toHaveBeenCalledWith(
      'games',
      expect.stringContaining('game_status')
    )
  })

  it('asks for twelve similar games so hidden ones can be dropped', async () => {
    const request = vi
      .spyOn(IGDBService as unknown as { request: RequestFn }, 'request')
      .mockResolvedValueOnce([
        { similar_games: Array.from({ length: 20 }, (_, i) => i + 1) }
      ])
      .mockResolvedValueOnce([])

    await IGDBService.getSimilarGames(5)

    expect(request).toHaveBeenLastCalledWith(
      'games',
      expect.stringContaining('where id = (1,2,3,4,5,6,7,8,9,10,11,12);')
    )
    expect(request).toHaveBeenLastCalledWith(
      'games',
      expect.stringContaining('limit 12;')
    )
  })
})

describe('IGDBService.getRelatedGames', () => {
  it('drops bundles, rumored games and cancelled games without a date', async () => {
    vi.spyOn(
      IGDBService as unknown as { request: RequestFn },
      'request'
    ).mockResolvedValue([
      { id: 1, name: 'Expansion', game_status: 0, first_release_date: 1 },
      { id: 2, name: 'Big Bundle', game_status: 0 },
      { id: 3, name: 'Rumored DLC', game_status: 7 },
      { id: 4, name: 'Cancelled DLC', game_status: 6 },
      { id: 5, name: 'Cancelled but dated', game_status: 6, first_release_date: 1 }
    ])

    const result = await IGDBService.getRelatedGames(10)

    expect(result.map(g => g.id)).toEqual([1, 5])
  })
})
