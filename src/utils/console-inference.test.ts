import { describe, it, expect } from 'vitest'
import {
  consoleFromPsnCategories,
  consoleFromXboxDevices,
  inferConsoleFromIgdbPlatforms,
  planConsoleBackfill,
  STEAM_CONSOLE
} from './console-inference'

describe('consoleFromXboxDevices', () => {
  it.each([
    [['Xbox360'], 'XBOX_360'],
    [['XboxOne'], 'XBOX_ONE'],
    [['XboxSeries'], 'XBOX_SERIES'],
    [['PC', 'XboxSeries'], 'XBOX_SERIES'],
    [['PC', 'XboxOne'], 'XBOX_ONE'],
    [['PC'], 'PC']
  ])('%j gives %s', (devices, expected) => {
    expect(consoleFromXboxDevices(devices)).toBe(expected)
  })

  it.each([
    [['XboxOne', 'XboxSeries']],
    [['Xbox360', 'XboxOne', 'XboxSeries']],
    [['PC', 'XboxOne', 'XboxSeries']],
    [['Xbox360', 'XboxOne']],
    [[]],
    [['SomethingNew']]
  ])('%j is ambiguous and stays UNKNOWN', devices => {
    expect(consoleFromXboxDevices(devices)).toBe('UNKNOWN')
  })

  it('gives UNKNOWN for the union of an Xbox 360 title and an Xbox One title', () => {
    expect(consoleFromXboxDevices(['Xbox360', 'XboxOne'])).toBe('UNKNOWN')
  })
})

describe('consoleFromPsnCategories', () => {
  it.each([
    [['ps4_game'], 'PS4'],
    [['ps4_game', 'ps4_game'], 'PS4'],
    [['ps5_native_game'], 'PS5']
  ])('%j gives %s', (categories, expected) => {
    expect(consoleFromPsnCategories(categories)).toBe(expected)
  })

  it.each([
    [['unknown']],
    [['ps4_game', 'ps5_native_game']],
    [['ps4_game', 'unknown']],
    [[]]
  ])('%j stays UNKNOWN', categories => {
    expect(consoleFromPsnCategories(categories)).toBe('UNKNOWN')
  })
})

describe('Steam', () => {
  it('always gives PC', () => {
    expect(STEAM_CONSOLE).toBe('PC')
  })
})

describe('inferConsoleFromIgdbPlatforms', () => {
  it.each([
    ['PLAYSTATION', ['PlayStation 3'], 'PS3'],
    ['PLAYSTATION', ['PlayStation 5', 'PC (Microsoft Windows)'], 'PS5'],
    ['XBOX', ['Xbox Series X|S'], 'XBOX_SERIES'],
    ['XBOX', ['Xbox Series X|S', 'PC (Microsoft Windows)'], 'XBOX_SERIES'],
    ['XBOX', ['PC (Microsoft Windows)'], 'PC'],
    ['NINTENDO', ['Nintendo Switch 2'], 'SWITCH_2'],
    ['NINTENDO', ['Wii U'], 'WII_U'],
    ['EPIC', ['PC (Microsoft Windows)', 'Mac'], 'PC'],
    ['GOG', ['Linux'], 'PC']
  ])('%s with %j gives %s', (platform, names, expected) => {
    expect(
      inferConsoleFromIgdbPlatforms(platform as never, names as string[])
    ).toEqual({ console: expected })
  })

  it.each([
    ['PLAYSTATION', ['PlayStation 4'], 'has-successor'],
    ['XBOX', ['Xbox One'], 'has-successor'],
    ['XBOX', ['Xbox 360'], 'has-successor'],
    ['XBOX', ['Xbox'], 'has-successor'],
    ['NINTENDO', ['Wii'], 'has-successor'],
    ['NINTENDO', ['Nintendo DS'], 'has-successor'],
    ['NINTENDO', ['Game Boy Color'], 'has-successor'],
    ['PLAYSTATION', ['PlayStation 2'], 'has-successor'],
    ['PLAYSTATION', ['PlayStation Portable'], 'has-successor'],
    ['NINTENDO', ['Nintendo Switch'], 'has-successor'],
    ['STEAM', ['PC (Microsoft Windows)'], 'has-successor'],
    ['PLAYSTATION', ['PlayStation 4', 'PlayStation 5'], 'ambiguous'],
    ['XBOX', ['Xbox 360', 'Xbox One'], 'ambiguous'],
    ['PLAYSTATION', ['Xbox One'], 'none-in-ecosystem'],
    ['PLAYSTATION', [], 'no-data'],
    ['PLAYSTATION', null, 'no-data']
  ])('%s with %j is skipped as %s', (platform, names, reason) => {
    expect(
      inferConsoleFromIgdbPlatforms(platform as never, names as string[] | null)
    ).toEqual({ skip: reason })
  })
})

describe('planConsoleBackfill', () => {
  const row = (overrides = {}) => ({
    id: 'r1',
    userGameId: 'ug1',
    platform: 'PLAYSTATION' as const,
    igdbPlatformNames: ['PlayStation 3'],
    siblingConsoles: [],
    ...overrides
  })

  it('plans an update for a row with one possible console', () => {
    const plan = planConsoleBackfill([row()])

    expect(plan.updates).toEqual([
      { id: 'r1', userGameId: 'ug1', platform: 'PLAYSTATION', to: 'PS3' }
    ])
  })

  it('counts every reason it leaves a row alone', () => {
    const plan = planConsoleBackfill([
      row({ id: 'a', igdbPlatformNames: ['PlayStation 4'] }),
      row({ id: 'b', igdbPlatformNames: ['PlayStation 3', 'PlayStation 5'] }),
      row({ id: 'c', igdbPlatformNames: null }),
      row({ id: 'd', igdbPlatformNames: ['Xbox One'] }),
      row({ id: 'e', siblingConsoles: ['PS3'] })
    ])

    expect(plan.updates).toEqual([])
    expect(plan.skipped).toEqual({
      'no-data': 1,
      'none-in-ecosystem': 1,
      ambiguous: 1,
      'has-successor': 1,
      conflict: 1
    })
  })
})
