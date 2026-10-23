import { describe, it, expect } from 'vitest'
import { GAME_STATUS, isHiddenFromCatalog } from './game-status'

const DATE = 1_500_000_000

describe('isHiddenFromCatalog', () => {
  it.each([null, undefined])('shows a game with no status (%s), with or without date', status => {
    expect(isHiddenFromCatalog(status, null)).toBe(false)
    expect(isHiddenFromCatalog(status, DATE)).toBe(false)
  })

  it('hides a rumored game with or without a date', () => {
    expect(isHiddenFromCatalog(GAME_STATUS.RUMORED, null)).toBe(true)
    expect(isHiddenFromCatalog(GAME_STATUS.RUMORED, DATE)).toBe(true)
  })

  it('hides a cancelled game only when it has no date', () => {
    expect(isHiddenFromCatalog(GAME_STATUS.CANCELLED, null)).toBe(true)
    expect(isHiddenFromCatalog(GAME_STATUS.CANCELLED, undefined)).toBe(true)
    expect(isHiddenFromCatalog(GAME_STATUS.CANCELLED, DATE)).toBe(false)
  })

  it.each([
    GAME_STATUS.RELEASED,
    GAME_STATUS.ALPHA,
    GAME_STATUS.BETA,
    GAME_STATUS.EARLY_ACCESS,
    GAME_STATUS.OFFLINE,
    GAME_STATUS.DELISTED
  ])('shows a game with status %i, with or without date', status => {
    expect(isHiddenFromCatalog(status, null)).toBe(false)
    expect(isHiddenFromCatalog(status, DATE)).toBe(false)
  })
})
