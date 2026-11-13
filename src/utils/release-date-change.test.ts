import { describe, it, expect } from 'vitest'
import { classifyReleaseDateChange } from './release-date-change'

const NOW = 1_800_000_000
const PAST = NOW - 86_400
const PAST_2 = NOW - 2 * 86_400
const FUTURE = NOW + 86_400
const FUTURE_2 = NOW + 2 * 86_400

function classify(
  cacheReleaseDate: number | null,
  igdbReleaseDate: number | null,
  igdbGameStatus: number | null = null
) {
  return classifyReleaseDateChange({
    cacheReleaseDate,
    igdbReleaseDate,
    igdbGameStatus,
    nowEpoch: NOW
  })
}

describe('classifyReleaseDateChange', () => {
  it.each([
    ['both in the future', FUTURE, FUTURE],
    ['both in the past', PAST, PAST],
    ['both without a date', null, null]
  ])('does not write when the dates are the same: %s', (_n, cache, igdb) => {
    expect(classify(cache, igdb)).toMatchObject({
      kind: 'igual',
      writes: false
    })
  })

  it.each([
    ['already released in IGDB', FUTURE, PAST, 'ja_lancado'],
    ['another future date', FUTURE, FUTURE_2, 'outra_data_futura'],
    ['delayed into the future', PAST, FUTURE, 'adiado_para_o_futuro'],
    ['another past date', PAST, PAST_2, 'outra_data_passada']
  ])('%s', (_n, cache, igdb, kind) => {
    expect(classify(cache, igdb)).toEqual({
      kind,
      writes: true,
      newReleaseDate: igdb
    })
  })

  it('treats a date exactly now as not in the future', () => {
    expect(classify(NOW, FUTURE).kind).toBe('adiado_para_o_futuro')
    expect(classify(FUTURE, NOW).kind).toBe('ja_lancado')
  })

  it('writes NULL only when IGDB removed the date and says the game is released', () => {
    expect(classify(FUTURE, null, 0)).toEqual({
      kind: 'data_removida',
      writes: true,
      newReleaseDate: null
    })
  })

  it.each([
    ['alpha', 2],
    ['early access', 4],
    ['cancelled', 6],
    ['no status', null]
  ])(
    'keeps the cached date when IGDB removed it and the status is %s',
    (_n, status) => {
      expect(classify(FUTURE, null, status)).toEqual({
        kind: 'data_removida_ignorada',
        writes: false,
        newReleaseDate: FUTURE
      })
    }
  )

  it('does not write NULL over a row the cache itself marks as cancelled', () => {
    expect(
      classifyReleaseDateChange({
        cacheReleaseDate: FUTURE,
        igdbReleaseDate: null,
        igdbGameStatus: 0,
        cacheGameStatus: 6,
        nowEpoch: NOW
      })
    ).toEqual({
      kind: 'data_removida_ignorada',
      writes: false,
      newReleaseDate: FUTURE
    })
  })

  it('adds a date to a row that had none', () => {
    expect(classify(null, PAST)).toEqual({
      kind: 'data_adicionada',
      writes: true,
      newReleaseDate: PAST
    })
  })
})
