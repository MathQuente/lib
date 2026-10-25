import { describe, it, expect } from 'vitest'
import {
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

function matches(clause: Clause, row: { status: number | null; date: number | null }) {
  const { gameStatus, releaseDate } = clause
  if (gameStatus === null) return row.status === null
  if (typeof gameStatus === 'number') {
    if (row.status !== gameStatus) return false
  } else if (gameStatus) {
    if (row.status === null || gameStatus.notIn.includes(row.status)) return false
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
    expect(fragment.sql).toMatch(/THEN 0[\s\S]*THEN 1[\s\S]*THEN 2[\s\S]*ELSE 3/)
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
