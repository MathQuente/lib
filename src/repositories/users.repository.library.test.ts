import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  userGame: { findMany: vi.fn() }
}))

vi.mock('../database/db', () => ({ prisma: prismaMock }))

import { UserRepository } from './users.repository'

type SqlCall = { sql: string; values: unknown[] }

function lastQuery(): SqlCall {
  const calls = prismaMock.$queryRaw.mock.calls
  return calls[calls.length - 1][0] as SqlCall
}

describe('UserRepository.findManyGamesOfUser preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$queryRaw.mockResolvedValue([])
  })

  it('ranks the games inside each status and keeps the first N of each', async () => {
    await new UserRepository().findManyGamesOfUser({
      userId: 'user-1',
      previewPerStatus: 24
    })

    const { sql, values } = lastQuery()
    expect(sql).toContain('ROW_NUMBER() OVER (PARTITION BY ugs.status ORDER BY')
    expect(sql).toContain('ug.id) AS rn')
    expect(sql).toContain('WHERE ranked.rn <= ')
    expect(values).toContain(24)
  })

  it('selects named columns from the ranked rows, so rn never reaches the result', async () => {
    await new UserRepository().findManyGamesOfUser({
      userId: 'user-1',
      previewPerStatus: 6
    })

    const { sql } = lastQuery()
    expect(sql).toContain('ranked."igdbId"')
    expect(sql).not.toMatch(/SELECT\s+ranked\.\*/)
    expect(sql).not.toMatch(/SELECT\s+\*/)
  })

  it('ignores the preview when the caller also paginates', async () => {
    await new UserRepository().findManyGamesOfUser({
      userId: 'user-1',
      previewPerStatus: 24,
      take: 48,
      skip: 0
    })

    expect(lastQuery().sql).not.toContain('ROW_NUMBER')
  })

  it('does not rank anything without a preview', async () => {
    await new UserRepository().findManyGamesOfUser({ userId: 'user-1' })

    expect(lastQuery().sql).not.toContain('ROW_NUMBER')
  })

  it('breaks ties by id in the plain query too, so pages stay stable', async () => {
    await new UserRepository().findManyGamesOfUser({
      userId: 'user-1',
      filter: 'PLAYED',
      take: 48,
      skip: 0
    })

    expect(lastQuery().sql).toMatch(/ORDER BY [\s\S]*, ug\.id\s+LIMIT/)
  })
})

describe('UserRepository.findLibraryIgdbIds', () => {
  it('returns the igdb id of every game of the user, whatever the status', async () => {
    prismaMock.userGame.findMany.mockResolvedValue([
      { igdbId: 1 },
      { igdbId: 5 }
    ])

    const ids = await new UserRepository().findLibraryIgdbIds('user-1')

    expect(prismaMock.userGame.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { igdbId: true }
    })
    expect(ids).toEqual([1, 5])
  })
})
