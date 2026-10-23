import { describe, it, expect, vi } from 'vitest'
import { Console } from '@prisma/client'
import { BackfillRow, BackfillUpdate } from './console-inference'
import { runConsoleBackfill } from './console-backfill-run'

type Table = Map<string, { row: BackfillRow; console: Console }>

function makeTable(): Table {
  const rows: BackfillRow[] = [
    {
      id: 'a',
      userGameId: 'g1',
      platform: 'PLAYSTATION',
      igdbPlatformNames: ['PlayStation 3'],
      siblingConsoles: []
    },
    {
      id: 'b',
      userGameId: 'g2',
      platform: 'PLAYSTATION',
      igdbPlatformNames: ['PlayStation 4'],
      siblingConsoles: []
    },
    {
      id: 'c',
      userGameId: 'g3',
      platform: 'XBOX',
      igdbPlatformNames: ['Xbox Series X|S'],
      siblingConsoles: []
    },
    {
      id: 'd',
      userGameId: 'g4',
      platform: 'EPIC',
      igdbPlatformNames: ['PC (Microsoft Windows)'],
      siblingConsoles: ['UNKNOWN'] as never
    },
    {
      id: 'e',
      userGameId: 'g5',
      platform: 'GOG',
      igdbPlatformNames: ['PC (Microsoft Windows)'],
      siblingConsoles: []
    }
  ]
  return new Map(
    rows.map(row => [row.id, { row, console: 'UNKNOWN' as Console }])
  )
}

function depsFor(table: Table, pageSize = 2) {
  const applyBatch = vi.fn(async (updates: BackfillUpdate[]) => {
    const changed: string[] = []
    for (const update of updates) {
      const entry = table.get(update.id)!
      if (entry.console !== 'UNKNOWN') continue
      entry.console = update.to
      changed.push(update.id)
    }
    return changed
  })
  const fetchBatch = vi.fn(async (afterId: string) =>
    [...table.values()]
      .filter(e => e.console === 'UNKNOWN' && e.row.id > afterId)
      .sort((x, y) => x.row.id.localeCompare(y.row.id))
      .slice(0, pageSize)
      .map(e => e.row)
  )
  return { fetchBatch, applyBatch }
}

describe('runConsoleBackfill', () => {
  it('writes nothing in a dry run and reports what it would fill', async () => {
    const table = makeTable()
    const deps = depsFor(table)

    const result = await runConsoleBackfill(false, deps)

    expect(deps.applyBatch).not.toHaveBeenCalled()
    expect([...table.values()].every(e => e.console === 'UNKNOWN')).toBe(true)
    expect(result.scanned).toBe(5)
    expect(result.filled).toBe(4)
    expect(Object.fromEntries(result.counts)).toEqual({
      'PLAYSTATION -> PS3': 1,
      'XBOX -> XBOX_SERIES': 1,
      'EPIC -> PC': 1,
      'GOG -> PC': 1
    })
    expect(result.skipped['has-successor']).toBe(1)
    expect(result.log).toEqual([])
  })

  it('applies the plan in batches and logs the previous value of every row', async () => {
    const table = makeTable()
    const deps = depsFor(table)

    const result = await runConsoleBackfill(true, deps)

    expect(deps.applyBatch.mock.calls.length).toBeGreaterThan(1)
    expect(table.get('a')!.console).toBe('PS3')
    expect(table.get('b')!.console).toBe('UNKNOWN')
    expect(table.get('c')!.console).toBe('XBOX_SERIES')
    expect(result.log).toHaveLength(4)
    expect(result.log.every(entry => entry.from === 'UNKNOWN')).toBe(true)
    expect(result.log.map(e => e.id).sort()).toEqual(['a', 'c', 'd', 'e'])
  })

  it('does not change anything on a second run', async () => {
    const table = makeTable()
    await runConsoleBackfill(true, depsFor(table))
    const snapshot = [...table.entries()].map(([id, e]) => [id, e.console])

    const second = await runConsoleBackfill(true, depsFor(table))

    expect(second.filled).toBe(0)
    expect(second.log).toEqual([])
    expect([...table.entries()].map(([id, e]) => [id, e.console])).toEqual(
      snapshot
    )
  })

  it('leaves out rows the database did not change', async () => {
    const table = makeTable()
    const deps = depsFor(table)
    deps.applyBatch.mockImplementation(async () => [])

    const result = await runConsoleBackfill(true, deps)

    expect(result.filled).toBe(0)
    expect(result.log).toEqual([])
  })
})

describe('runConsoleBackfill log callback', () => {
  it('hands over the accumulated log after every applied batch', async () => {
    const table = makeTable()
    const onBatchApplied = vi.fn()

    const result = await runConsoleBackfill(
      true,
      depsFor(table),
      onBatchApplied
    )

    expect(onBatchApplied.mock.calls.length).toBeGreaterThan(1)
    const sizes = onBatchApplied.mock.calls.map(([log]) => log.length)
    expect(sizes[sizes.length - 1]).toBe(result.log.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  it('does not call it in a dry run', async () => {
    const onBatchApplied = vi.fn()

    await runConsoleBackfill(false, depsFor(makeTable()), onBatchApplied)

    expect(onBatchApplied).not.toHaveBeenCalled()
  })
})
