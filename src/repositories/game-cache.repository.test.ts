import { describe, it, expect } from 'vitest'
import {
  catalogVisibilitySql,
  catalogVisibilityWhere
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
