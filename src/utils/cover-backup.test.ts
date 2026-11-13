import { describe, it, expect } from 'vitest'
import { formatCoverBackup, parseCoverBackup } from './cover-backup'

const OLD = 'https://images.igdb.com/igdb/image/upload/t_cover_big/coc7pg.jpg'
const NEW = 'https://images.igdb.com/igdb/image/upload/t_cover_big/cocv5r.jpg'

describe('cover backup file', () => {
  it('round-trips the changes, including a previously missing cover', () => {
    const rows = [
      { igdbId: 405460, previous: OLD, next: NEW },
      { igdbId: 7, previous: null, next: NEW }
    ]

    expect(parseCoverBackup(formatCoverBackup(rows) + '\n')).toEqual(rows)
  })

  it.each([
    ['not json', 'oops'],
    [
      'an id that is not an integer',
      '{"igdbId":1.5,"previous":null,"next":"%NEW%"}'
    ],
    [
      'a next that is not an https image url',
      '{"igdbId":1,"previous":null,"next":"http://x/a.jpg"}'
    ],
    ['a missing next', '{"igdbId":1,"previous":null}'],
    ['an empty previous string', '{"igdbId":1,"previous":"","next":"%NEW%"}']
  ])('rejects %s', (_label, line) => {
    expect(() => parseCoverBackup(line.replace('%NEW%', NEW))).toThrow(
      /Invalid backup line/
    )
  })
})
