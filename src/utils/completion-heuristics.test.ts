import { describe, it, expect } from 'vitest'
import { IGDBGame } from '../types/igdb'
import {
  canInferCompletion,
  COMPLETION_KEYWORD_PATTERN,
  evaluateFinishSuggestion,
  hasLockedPlainEndAchievement,
  hasPracticalEnd,
  isPlainEndAchievement,
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

describe('evaluateFinishSuggestion', () => {
  const single = game(['Role-playing (RPG)'], ['Single player'])
  const base = {
    game: single,
    hoursPlayed: 33.8,
    normallyHours: 33.1,
    achieved: 7,
    total: 45,
    heuristicFinished: false
  }

  it('suggests a narrative game past its time to beat with 15% of the achievements', () => {
    expect(evaluateFinishSuggestion(base)).toEqual({
      suggest: true,
      lowConfidence: false,
      signals: ['playtime']
    })
  })

  it('suggests when only the current heuristic says finished', () => {
    expect(
      evaluateFinishSuggestion({
        ...base,
        achieved: 1,
        hoursPlayed: 2,
        heuristicFinished: true
      })
    ).toMatchObject({ suggest: true, signals: ['heuristic'] })
  })

  it('does not suggest below 10% of the achievements', () => {
    expect(evaluateFinishSuggestion({ ...base, achieved: 4 }).suggest).toBe(false)
  })

  it('does not suggest before the time to beat', () => {
    expect(evaluateFinishSuggestion({ ...base, hoursPlayed: 30 }).suggest).toBe(false)
  })

  it('does not suggest without a time to beat or with too few achievements', () => {
    expect(evaluateFinishSuggestion({ ...base, normallyHours: undefined }).suggest).toBe(false)
    expect(evaluateFinishSuggestion({ ...base, achieved: 1, total: 4 }).suggest).toBe(false)
  })

  it('does not suggest for a game that cannot be completed', () => {
    expect(
      evaluateFinishSuggestion({ ...base, game: game(['Shooter'], ['Multiplayer']) }).suggest
    ).toBe(false)
  })

  it('flags a game that also has a multiplayer mode as low confidence', () => {
    const result = evaluateFinishSuggestion({
      ...base,
      game: game(['Party'], ['Single player', 'Multiplayer']),
      hoursPlayed: 5.1,
      normallyHours: 4,
      achieved: 4,
      total: 33
    })
    expect(result).toMatchObject({ suggest: true, lowConfidence: true })
  })
})

describe('COMPLETION_KEYWORD_PATTERN with the main story wording', () => {
  it.each([
    'Finish the main storyline',
    'Complete the main story',
    'Finished the main campaign'
  ])('matches "%s"', text => {
    expect(COMPLETION_KEYWORD_PATTERN.test(text)).toBe(true)
  })
})

describe('isPlainEndAchievement', () => {
  it.each([
    'Finish the main storyline',
    'Complete the game',
    'Beat the game'
  ])('accepts "%s"', text => {
    expect(isPlainEndAchievement(text)).toBe(true)
  })

  it.each([
    'Beat the game in 300 days.',
    'Complete the game on the hardcore difficulty',
    'Complete the game on "Hard" difficulty.',
    'Complete the game without using a recovery item.',
    'Complete all main game Challenge Tombs',
    'Completed New Game+.',
    "Complete Claire's story.",
    'Reach the epilogue of the story'
  ])('rejects the variant or side goal "%s"', text => {
    expect(isPlainEndAchievement(text)).toBe(false)
  })
})

describe('hasLockedPlainEndAchievement', () => {
  const schema = new Map([
    ['End', 'Finish the main storyline'],
    ['Hard', 'Complete the game on the hardcore difficulty'],
    ['Other', 'Burn 2 enemies simultaneously']
  ])

  it('is true when the plain end achievement is locked', () => {
    expect(hasLockedPlainEndAchievement(schema, ['Other'])).toBe(true)
  })

  it('is false when the plain end achievement is unlocked', () => {
    expect(hasLockedPlainEndAchievement(schema, ['End'])).toBe(false)
  })

  it('ignores locked variants and a missing schema', () => {
    expect(
      hasLockedPlainEndAchievement(new Map([['Hard', schema.get('Hard')!]]), [])
    ).toBe(false)
    expect(hasLockedPlainEndAchievement(null, [])).toBe(false)
  })
})

describe('hasPracticalEnd', () => {
  it.each([
    [undefined, true],
    [132, true],
    [299.9, true],
    [300, false],
    [2020, false]
  ])('time to beat %s hours gives %s', (hours, expected) => {
    expect(hasPracticalEnd(hours)).toBe(expected)
  })
})

describe('evaluateFinishSuggestion with blocked weak signals', () => {
  it('does not suggest when the weak signals are blocked', () => {
    const result = evaluateFinishSuggestion({
      game: game(['Adventure'], ['Single player']),
      hoursPlayed: 25.5,
      normallyHours: 22.1,
      achieved: 52,
      total: 99,
      heuristicFinished: true,
      weakSignalsBlocked: true
    })
    expect(result.suggest).toBe(false)
  })
})
