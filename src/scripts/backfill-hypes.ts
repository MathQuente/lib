import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { BATCH_SIZE, DELAY_MS, sleep } from './utils'

async function main() {
  const repo = new GameCacheRepository()

  let totalUpdated = 0
  let batch = 0

  console.log('Backfilling hypes for cached games missing it...')
  console.log(
    'Press Ctrl+C to stop (safe — next run resumes from where it stopped)\n'
  )

  while (true) {
    batch++
    const igdbIds = await repo.findManyMissingHypes(BATCH_SIZE)

    if (igdbIds.length === 0) {
      console.log('\nBackfill complete — no more games missing hypes.')
      break
    }

    const hypesMap = await IGDBService.getHypesByIds(igdbIds)
    await repo.updateHypes(
      igdbIds.map(igdbId => ({ igdbId, hypes: hypesMap.get(igdbId) ?? 0 }))
    )

    totalUpdated += igdbIds.length
    process.stdout.write(
      `\rBatch ${batch} | +${igdbIds.length} games | Total updated: ${totalUpdated}`
    )

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Total updated this run: ${totalUpdated}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
