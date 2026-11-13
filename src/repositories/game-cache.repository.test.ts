import { describe, it, expect, vi, afterEach } from 'vitest'
import { prisma } from '../database/db'
import {
  GameCacheRepository,
  catalogVisibilitySql,
  catalogVisibilityWhere,
  escapeLike,
  normalizeSearchTerm,
  relevanceMatchSql,
  relevanceOrderSql
} from './game-cache.repository'
import { isHiddenFromCatalog } from '../utils/game-status'

type Clause = {
  gameStatus?: null | number | { notIn: number[] }
  releaseDate?: { not: null }
}

function matches(
  clause: Clause,
  row: { status: number | null; date: number | null }
) {
  const { gameStatus, releaseDate } = clause
  if (gameStatus === null) return row.status === null
  if (typeof gameStatus === 'number') {
    if (row.status !== gameStatus) return false
  } else if (gameStatus) {
    if (row.status === null || gameStatus.notIn.includes(row.status))
      return false
  }
  if (releaseDate && row.date === null) return false
  return true
}

describe('catalogVisibilityWhere', () => {
  const clauses = catalogVisibilityWhere().OR as Clause[]
  const statuses = [null, 0, 2, 3, 4, 5, 6, 7, 8]
  const dates = [null, 1_500_000_000]

  it.each(statuses.flatMap(status => dates.map(date => ({ status, date }))))(
    'agrees with isHiddenFromCatalog for status $status and date $date',
    row => {
      const visible = clauses.some(clause => matches(clause, row))
      expect(visible).toBe(!isHiddenFromCatalog(row.status, row.date))
    }
  )

  it('lets a game with no status through explicitly', () => {
    expect(clauses).toContainEqual({ gameStatus: null })
  })
})

describe('catalogVisibilitySql', () => {
  it('lets NULL through explicitly and hides rumored and dateless cancelled games', () => {
    const fragment = catalogVisibilitySql()

    expect(fragment.sql).toBe(
      '(gc.game_status IS NULL OR gc.game_status NOT IN (?,?) OR (gc.game_status = ? AND gc.release_date IS NOT NULL))'
    )
    expect(fragment.values).toEqual([6, 7, 6])
  })
})

describe('normalizeSearchTerm', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSearchTerm('  super   mario ')).toBe('super mario')
  })

  it('returns an empty string for a blank or missing query', () => {
    expect(normalizeSearchTerm('   ')).toBe('')
    expect(normalizeSearchTerm(undefined)).toBe('')
  })
})

describe('escapeLike', () => {
  it('escapes backslash, percent and underscore', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeLike('super mario')).toBe('super mario')
  })
})

describe('relevanceMatchSql', () => {
  it('folds case and accents on both sides and escapes the term', () => {
    const fragment = relevanceMatchSql('50%')

    expect(fragment.sql).toBe(
      "unaccent(lower(gc.name)) LIKE unaccent(lower(?)) ESCAPE '\\'"
    )
    expect(fragment.values).toEqual(['%50\\%%'])
  })
})

describe('relevanceOrderSql', () => {
  it('ranks exact, prefix, word-start and substring matches in that order', () => {
    const fragment = relevanceOrderSql('mario')

    expect(fragment.values).toEqual(['mario', 'mario%', '% mario%'])
    expect(fragment.sql).toMatch(
      /THEN 0[\s\S]*THEN 1[\s\S]*THEN 2[\s\S]*ELSE 3/
    )
  })

  it('puts base games before derived ones, then popularity, name and id', () => {
    const { sql } = relevanceOrderSql('mario')

    const order = [
      'gc.parent_game_id IS NOT NULL',
      'gc.total_rating_count DESC NULLS LAST',
      'gc.hypes DESC NULLS LAST',
      'gc.name ASC',
      'gc.igdb_id ASC'
    ].map(part => sql.indexOf(part))

    expect(order.every(index => index > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('escapes wildcards in the prefix and word-start patterns only', () => {
    const fragment = relevanceOrderSql('a_b')

    expect(fragment.values).toEqual(['a_b', 'a\\_b%', '% a\\_b%'])
  })
})

describe('GameCacheRepository.updateCategories', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['an empty batch', []],
    ['only unknown categories', [{ igdbId: 1, category: -1 }]],
    [
      'a null or non-integer category',
      [
        { igdbId: 1, category: null as unknown as number },
        { igdbId: 2, category: 1.5 }
      ]
    ]
  ])('does not write for %s', async (_label, updates) => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    await new GameCacheRepository().updateCategories(updates)

    expect(execute).not.toHaveBeenCalled()
  })

  it('writes only the known categories, including 0, in one statement', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(2)

    await new GameCacheRepository().updateCategories([
      { igdbId: 1, category: 8 },
      { igdbId: 2, category: -1 },
      { igdbId: 3, category: 0 }
    ])

    expect(execute).toHaveBeenCalledTimes(1)
    const [sql] = execute.mock.calls[0] as unknown as [{ values: unknown[] }]
    expect(JSON.parse(String(sql.values[0]))).toEqual([
      { id: 1, category: 8 },
      { id: 3, category: 0 }
    ])
  })
})

function sqlOf(execute: { mock: { calls: unknown[][] } }, call = 0) {
  const [sql] = execute.mock.calls[call] as unknown as [
    { strings: string[]; values: unknown[] }
  ]
  return sql
}

describe('GameCacheRepository.updateReleaseDates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not write an empty batch', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    expect(await new GameCacheRepository().updateReleaseDates([])).toBe(0)
    expect(execute).not.toHaveBeenCalled()
  })

  it('throws, without writing anything, when a date is not an integer', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    await expect(
      new GameCacheRepository().updateReleaseDates([
        { igdbId: 1, releaseDate: 1793836800 },
        { igdbId: 2, releaseDate: 1.5 }
      ])
    ).rejects.toThrow(/Invalid release date for 2/)
    expect(execute).not.toHaveBeenCalled()
  })

  it('writes dates and NULL in one statement that only sets release_date', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(2)

    const written = await new GameCacheRepository().updateReleaseDates([
      { igdbId: 1, releaseDate: 1793836800 },
      { igdbId: 2, releaseDate: null }
    ])

    expect(written).toBe(2)
    expect(execute).toHaveBeenCalledTimes(1)
    const sql = sqlOf(execute)
    const text = sql.strings.join('?')
    expect(text.match(/\bSET\b/g)).toHaveLength(1)
    expect(text).toContain('SET release_date = v.release_date')
    expect(text).toContain('IS DISTINCT FROM')
    expect(JSON.parse(String(sql.values[0]))).toEqual([
      { id: 1, release_date: 1793836800 },
      { id: 2, release_date: null }
    ])
  })
})

describe('GameCacheRepository.restoreReleaseDates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const rows = [
    { igdbId: 1, previous: 1798675200, next: 1793836800 },
    { igdbId: 2, previous: 1798675200, next: null }
  ]

  it('does nothing for an empty file', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    expect(await new GameCacheRepository().restoreReleaseDates([], false)).toBe(
      0
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('restores only rows whose current date is still the one the backfill wrote, NULL included', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(2)

    const restored = await new GameCacheRepository().restoreReleaseDates(
      rows,
      false
    )

    expect(restored).toBe(2)
    const text = sqlOf(execute).strings.join('?')
    expect(text).toContain('SET release_date = v.previous')
    expect(text).toContain('IS NOT DISTINCT FROM v.next')
  })

  it('counts what would be restored in a dry run without writing', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)
    const query = vi
      .spyOn(prisma, '$queryRaw')
      .mockResolvedValue([{ count: BigInt(1) }] as never)

    const count = await new GameCacheRepository().restoreReleaseDates(
      rows,
      true
    )

    expect(count).toBe(1)
    expect(execute).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(1)
  })
})

const COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big/cocv5r.jpg'

describe('GameCacheRepository.updateCoverUrls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not write an empty batch', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    expect(await new GameCacheRepository().updateCoverUrls([])).toBe(0)
    expect(execute).not.toHaveBeenCalled()
  })

  it('throws, without writing anything, when a url is not https', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)

    await expect(
      new GameCacheRepository().updateCoverUrls([
        { igdbId: 1, coverUrl: COVER },
        { igdbId: 2, coverUrl: 'http://x/a.jpg' }
      ])
    ).rejects.toThrow(/Invalid cover url for 2/)
    expect(execute).not.toHaveBeenCalled()
  })

  it('writes in one statement that only sets cover_url', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(1)

    const written = await new GameCacheRepository().updateCoverUrls([
      { igdbId: 1, coverUrl: COVER }
    ])

    expect(written).toBe(1)
    const text = sqlOf(execute).strings.join('?')
    expect(text.match(/\bSET\b/g)).toHaveLength(1)
    expect(text).toContain('SET cover_url = v.cover_url')
    expect(text).toContain('IS DISTINCT FROM')
    expect(JSON.parse(String(sqlOf(execute).values[0]))).toEqual([
      { id: 1, cover_url: COVER }
    ])
  })
})

describe('GameCacheRepository.restoreCoverUrls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const rows = [
    { igdbId: 1, previous: 'https://images.igdb.com/a/old.jpg', next: COVER },
    { igdbId: 2, previous: null, next: COVER }
  ]

  it('restores only rows still holding the cover the backfill wrote', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(2)

    expect(await new GameCacheRepository().restoreCoverUrls(rows, false)).toBe(
      2
    )
    const text = sqlOf(execute).strings.join('?')
    expect(text).toContain('SET cover_url = v.previous')
    expect(text).toContain('IS NOT DISTINCT FROM v.next')
  })

  it('counts without writing in a dry run', async () => {
    const execute = vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0)
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([
      { count: BigInt(1) }
    ] as never)

    expect(await new GameCacheRepository().restoreCoverUrls(rows, true)).toBe(1)
    expect(execute).not.toHaveBeenCalled()
  })
})
