import { describe, it, expect } from 'vitest'
import { IGDBGame } from '../types/igdb'
import {
  canInferCompletion,
  COMPLETION_KEYWORD_PATTERN,
  hasSinglePlayerMode,
  meetsPlaytimeSignal
} from './completion-heuristics'

function game(genres: string[], modes: string[]): IGDBGame {
  return {
    id: 1,
    name: 'Game',
    genres: genres.map(name => ({ name })),
    game_modes: modes.map(name => ({ name }))
  } as IGDBGame
}

describe('canInferCompletion', () => {
  it('accepts a single-player sport game', () => {
    expect(canInferCompletion(game(['Sport'], ['Single player']))).toBe(true)
  })

  it.each(['Multiplayer', 'Co-operative', 'Massively Multiplayer Online (MMO)', 'Battle Royale'])(
    'rejects a racing game that also has %s',
    mode => {
      expect(canInferCompletion(game(['Racing'], ['Single player', mode]))).toBe(false)
    }
  )

  it('rejects a game with no single-player mode', () => {
    expect(canInferCompletion(game(['Shooter'], ['Multiplayer']))).toBe(false)
  })

  it('accepts a single-player game of any other genre alongside multiplayer', () => {
    expect(
      canInferCompletion(game(['Adventure'], ['Single player', 'Multiplayer']))
    ).toBe(true)
  })
})

describe('meetsPlaytimeSignal', () => {
  const base = { hoursPlayed: 10, normallyHours: 10, achieved: 5, total: 20 }

  it('passes at exactly the time to beat and 25% of achievements', () => {
    expect(meetsPlaytimeSignal(base)).toBe(true)
  })

  it('fails just under 25% of achievements', () => {
    expect(meetsPlaytimeSignal({ ...base, achieved: 4, total: 17 })).toBe(false)
  })

  it('fails below the time to beat', () => {
    expect(meetsPlaytimeSignal({ ...base, hoursPlayed: 9.9 })).toBe(false)
  })

  it('fails without a known time to beat', () => {
    expect(meetsPlaytimeSignal({ ...base, normallyHours: undefined })).toBe(false)
  })

  it('fails when there are too few achievements to mean anything', () => {
    expect(meetsPlaytimeSignal({ ...base, achieved: 4, total: 4 })).toBe(false)
  })
})

describe('COMPLETION_KEYWORD_PATTERN', () => {
  it.each([
    'Completed the final mission.',
    'Complete the final chapter on any difficulty',
    'Beat the final battle',
    'Watch the credits',
    'Completed the final chapter.',
    'Season finale'
  ])('matches %s', text => {
    expect(COMPLETION_KEYWORD_PATTERN.test(text)).toBe(true)
  })

  it.each([
    'Complete the first mission',
    'Finalize your loadout',
    'Win 10 final-round matches'
  ])('does not match %s', text => {
    expect(COMPLETION_KEYWORD_PATTERN.test(text)).toBe(false)
  })
})

describe('hasSinglePlayerMode', () => {
  it('is true for a racing game with single player and multiplayer', () => {
    expect(
      hasSinglePlayerMode(game(['Racing'], ['Single player', 'Multiplayer']))
    ).toBe(true)
  })

  it('is false for a multiplayer-only game', () => {
    expect(hasSinglePlayerMode(game(['Shooter'], ['Multiplayer']))).toBe(false)
  })

  it('is true when IGDB lists no modes', () => {
    expect(hasSinglePlayerMode(game(['Shooter'], []))).toBe(true)
  })
})
