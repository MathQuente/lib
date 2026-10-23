import { describe, it, expect } from 'vitest'
import { Console, Platform } from '@prisma/client'
import { CONSOLES_BY_PLATFORM, isConsoleAllowed } from './platform-consoles'

describe('CONSOLES_BY_PLATFORM', () => {
  it.each(Object.values(Platform))('allows UNKNOWN on %s', platform => {
    expect(isConsoleAllowed(platform, 'UNKNOWN')).toBe(true)
  })

  it('has an entry for every platform', () => {
    expect(Object.keys(CONSOLES_BY_PLATFORM).sort()).toEqual(
      Object.values(Platform).sort()
    )
  })

  it.each([
    ['XBOX', 'XBOX_360', true],
    ['XBOX', 'PC', true],
    ['XBOX', 'PS5', false],
    ['PLAYSTATION', 'PS_VITA', true],
    ['PLAYSTATION', 'SWITCH', false],
    ['NINTENDO', 'SWITCH_2', true],
    ['STEAM', 'STEAM_DECK', true],
    ['STEAM', 'PS4', false],
    ['EPIC', 'PC', true],
    ['GOG', 'STEAM_DECK', false],
    ['OTHER', 'DREAMCAST', true],
    ['OTHER', 'PS5', true]
  ] as [Platform, Console, boolean][])(
    '%s with %s is %s',
    (platform, value, expected) => {
      expect(isConsoleAllowed(platform, value)).toBe(expected)
    }
  )

  it('lets OTHER take every console', () => {
    expect([...CONSOLES_BY_PLATFORM.OTHER].sort()).toEqual(
      Object.values(Console).sort()
    )
  })
})
