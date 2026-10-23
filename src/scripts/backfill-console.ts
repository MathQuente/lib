import 'dotenv/config'
import fs from 'node:fs'
import { Console, Platform, Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { BackfillRow, BackfillUpdate } from '../utils/console-inference'
import {
  BackfillLogEntry,
  runConsoleBackfill
} from '../utils/console-backfill-run'

const BATCH_SIZE = 500
const PLATFORMS: Platform[] = ['PLAYSTATION', 'XBOX', 'NINTENDO', 'EPIC', 'GOG']

const apply = process.argv.includes('--apply')
const revertIndex = process.argv.indexOf('--revert')
const revertFile = revertIndex === -1 ? null : process.argv[revertIndex + 1]

if (revertIndex !== -1 && (!revertFile || revertFile.startsWith('--'))) {
  console.error('--revert needs the path of a backfill-console-*.json file.')
  process.exit(1)
}

interface CandidateRow {
  id: string
  user_game_id: string
  platform: Platform
  igdb_platforms: string[] | null
  sibling_consoles: Console[] | null
}

async function fetchBatch(afterId: string): Promise<BackfillRow[]> {
  const rows = await prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
    SELECT
      p.id,
      p.user_game_id,
      p.platform::text AS platform,
      gc.platforms AS igdb_platforms,
      ARRAY(
        SELECT s.console::text
        FROM user_game_platforms s
        WHERE s.user_game_id = p.user_game_id
          AND s.platform = p.platform
          AND s.id <> p.id
      ) AS sibling_consoles
    FROM user_game_platforms p
    JOIN user_games g ON g.id = p.user_game_id
    LEFT JOIN games_cache gc ON gc.igdb_id = g.igdb_id
    WHERE p.console = 'UNKNOWN'
      AND p.platform::text IN (${Prisma.join(PLATFORMS)})
      AND p.id > ${afterId}
    ORDER BY p.id
    LIMIT ${BATCH_SIZE}
  `)

  return rows.map(r => ({
    id: r.id,
    userGameId: r.user_game_id,
    platform: r.platform,
    igdbPlatformNames: r.igdb_platforms,
    siblingConsoles: r.sibling_consoles ?? []
  }))
}

async function applyBatch(updates: BackfillUpdate[]): Promise<string[]> {
  if (updates.length === 0) return []
  const payload = JSON.stringify(updates.map(u => ({ id: u.id, to: u.to })))
  return prisma.$transaction(async tx => {
    const changed = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE user_game_platforms p
      SET console = v."to"::"Console", updated_at = now()
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, "to" text)
      WHERE p.id = v.id
        AND p.console = 'UNKNOWN'
        AND NOT EXISTS (
          SELECT 1 FROM user_game_platforms x
          WHERE x.user_game_id = p.user_game_id
            AND x.platform = p.platform
            AND x.console = v."to"::"Console"
        )
      RETURNING p.id
    `)
    return changed.map(c => c.id)
  })
}

async function revert(file: string) {
  const entries = JSON.parse(
    fs.readFileSync(file, 'utf8')
  ) as BackfillLogEntry[]
  let restored = 0
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const payload = JSON.stringify(
      entries.slice(i, i + BATCH_SIZE).map(e => ({ id: e.id, to: e.to }))
    )
    const changed = await prisma.$transaction(async tx =>
      tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE user_game_platforms p
        SET console = 'UNKNOWN', updated_at = now()
        FROM jsonb_to_recordset(${payload}::jsonb) AS v(id text, "to" text)
        WHERE p.id = v.id
          AND p.console = v."to"::"Console"
          AND NOT EXISTS (
            SELECT 1 FROM user_game_platforms x
            WHERE x.user_game_id = p.user_game_id
              AND x.platform = p.platform
              AND x.console = 'UNKNOWN'
          )
        RETURNING p.id
      `)
    )
    restored += changed.length
  }
  console.log(
    `Reverted ${restored} of ${entries.length} rows from ${file} (rows already changed again are left alone).`
  )
}

async function main() {
  if (revertFile) {
    await revert(revertFile)
    return
  }

  console.log(
    apply
      ? 'APPLYING: filling the console of UNKNOWN rows...'
      : 'DRY RUN: nothing is written. Use --apply to write.'
  )

  const logFile = `backfill-console-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const result = await runConsoleBackfill(
    apply,
    { fetchBatch, applyBatch },
    log => fs.writeFileSync(logFile, JSON.stringify(log, null, 2))
  )

  console.log(`\nUNKNOWN rows scanned: ${result.scanned}`)
  console.log(`${apply ? 'Filled' : 'Would fill'}: ${result.filled}`)
  for (const [key, count] of [...result.counts.entries()].sort()) {
    console.log(`  ${key}: ${count}`)
  }
  console.log('Left as UNKNOWN:')
  console.log(`  no platform data from IGDB: ${result.skipped['no-data']}`)
  console.log(
    `  no console of the ecosystem on IGDB: ${result.skipped['none-in-ecosystem']}`
  )
  console.log(`  several consoles (ambiguous): ${result.skipped.ambiguous}`)
  console.log(
    `  one console with a backward compatible successor: ${result.skipped['has-successor']}`
  )
  console.log(
    `  the target console already has a row: ${result.skipped.conflict}`
  )

  if (apply && result.log.length > 0) {
    console.log(
      `\nLog written to ${logFile}. Revert with: npm run backfill:console -- --revert ${logFile}`
    )
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
