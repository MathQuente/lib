import { Console, Platform } from '@prisma/client'
import {
  BackfillRow,
  BackfillSkip,
  BackfillUpdate,
  planConsoleBackfill
} from './console-inference'

export interface BackfillLogEntry {
  id: string
  userGameId: string
  platform: Platform
  from: 'UNKNOWN'
  to: Console
}

export interface BackfillDeps {
  fetchBatch(afterId: string): Promise<BackfillRow[]>
  applyBatch(updates: BackfillUpdate[]): Promise<string[]>
}

export async function runConsoleBackfill(
  apply: boolean,
  deps: BackfillDeps,
  onBatchApplied?: (log: BackfillLogEntry[]) => void
) {
  const counts = new Map<string, number>()
  const skipped: Record<BackfillSkip, number> = {
    'no-data': 0,
    'none-in-ecosystem': 0,
    ambiguous: 0,
    'has-successor': 0,
    conflict: 0
  }
  const log: BackfillLogEntry[] = []
  let scanned = 0
  let cursor = ''

  while (true) {
    const rows = await deps.fetchBatch(cursor)
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id
    scanned += rows.length

    const plan = planConsoleBackfill(rows)
    for (const key of Object.keys(skipped) as BackfillSkip[]) {
      skipped[key] += plan.skipped[key]
    }

    const changedIds = apply
      ? new Set(await deps.applyBatch(plan.updates))
      : new Set(plan.updates.map(u => u.id))

    for (const update of plan.updates) {
      if (!changedIds.has(update.id)) continue
      const key = `${update.platform} -> ${update.to}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (apply) {
        log.push({
          id: update.id,
          userGameId: update.userGameId,
          platform: update.platform,
          from: 'UNKNOWN',
          to: update.to
        })
      }
    }

    if (apply && changedIds.size > 0) onBatchApplied?.(log)
  }

  const filled = [...counts.values()].reduce((a, b) => a + b, 0)
  return { scanned, filled, counts, skipped, log }
}
