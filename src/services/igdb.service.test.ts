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
