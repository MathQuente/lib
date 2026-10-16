import { describe, it, expect, vi, afterEach } from 'vitest'
import { IGDBService } from './igdb.service'
import { IGDBGame } from '../types/igdb'

type RequestFn = (endpoint: string, body: string) => Promise<unknown>

function mockRequest(rows: { uid: string; game: number }[]) {
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
