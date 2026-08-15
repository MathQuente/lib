import 'dotenv/config'
import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { BATCH_SIZE, DELAY_MS, sleep } from './utils'

async function findMissingIgdbIds(
  limit: number,
  exclude: number[]
): Promise<number[]> {
  const excludeFilter =
    exclude.length > 0
      ? Prisma.sql`AND ug.igdb_id NOT IN (${Prisma.join(exclude)})`
      : Prisma.empty

  const rows = await prisma.$queryRaw<{ igdbId: number }[]>(Prisma.sql`
    SELECT DISTINCT ug.igdb_id AS "igdbId"
    FROM user_games ug
    LEFT JOIN games_cache gc ON gc.igdb_id = ug.igdb_id
    WHERE gc.igdb_id IS NULL
    ${excludeFilter}
    LIMIT ${limit}
  `)
  return rows.map(r => r.igdbId)
}

async function main() {
  const repo = new GameCacheRepository()

  let totalCached = 0
  let batch = 0
  const permanentlyMissing: number[] = []

  console.log('Backfilling games_cache gaps for games already in user libraries...')
  console.log(
    'Press Ctrl+C to stop (safe — next run resumes from where it stopped)\n'
  )

  while (true) {
    batch++
    const missingIds = await findMissingIgdbIds(BATCH_SIZE, permanentlyMissing)

    if (missingIds.length === 0) {
      console.log('\nBackfill complete — no more gaps.')
      break
    }

    const games = await IGDBService.getGamesByIds(missingIds)
    const foundIds = new Set(games.map(g => g.id))
    const notFound = missingIds.filter(id => !foundIds.has(id))

    if (notFound.length > 0) {
      console.log(
        `\nBatch ${batch}: IGDB no longer has these ids, skipping: ${notFound.join(',')}`
      )
      permanentlyMissing.push(...notFound)
    }

    if (games.length > 0) {
      await repo.upsertMany(games.map(g => IGDBService.toGameCacheInput(g)))
      totalCached += games.length
    }

    process.stdout.write(
      `\rBatch ${batch} | +${games.length} cached | Total cached this run: ${totalCached}`
    )

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Total cached this run: ${totalCached}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
