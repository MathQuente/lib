import { describe, it, expect } from 'vitest'
import {
  formatReleaseDateBackup,
  parseReleaseDateBackup
} from './release-date-backup'

describe('release date backup file', () => {
  it('round-trips numbers and NULL (empty field)', () => {
    const rows = [
      { igdbId: 405460, previous: 1798675200, next: 1793836800 },
      { igdbId: 7, previous: 1798675200, next: null },
      { igdbId: 8, previous: null, next: 1700000000 }
    ]

    const text = formatReleaseDateBackup(rows)

    expect(text.split('\n')[0]).toBe(
      'igdb_id,release_date_antiga,release_date_nova'
    )
    expect(text).toContain('7,1798675200,')
    expect(parseReleaseDateBackup(text + '\n')).toEqual(rows)
  })

  it('rejects a file that is not a backup', () => {
    expect(() => parseReleaseDateBackup('a,b,c\n1,2,3')).toThrow(/header/)
  })

  it.each(['abc,1,2', '1,2', '1,x,2', '1,2,3,4'])(
    'rejects the invalid line %j',
    line => {
      const text = `igdb_id,release_date_antiga,release_date_nova\n${line}`
      expect(() => parseReleaseDateBackup(text)).toThrow()
    }
  )
})
