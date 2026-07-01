import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'

const BATCH_SIZE = 500
const DELAY_MS = 300

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const repo = new GameCacheRepository()
  const maxId = await repo.getMaxIgdbId()

  console.log(`Backfilling DLCs/expansions/remasters skipped by earlier syncs (id <= ${maxId})...`)
  console.log('Press Ctrl+C to stop (safe — next run resumes from where it stopped)\n')

  let totalSynced = 0
  let currentLastId = 0
  let batch = 0

  while (true) {
    batch++
    const games = await IGDBService.fetchMissingReleasedContent(currentLastId, maxId, BATCH_SIZE)

    if (games.length === 0) {
      console.log('\nBackfill complete — no more missing content.')
      break
    }

    await repo.upsertMany(games.map(g => IGDBService.toGameCacheInput(g)))

    currentLastId = games[games.length - 1].id
    totalSynced += games.length

    process.stdout.write(`\rBatch ${batch} | +${games.length} games | Total added: ${totalSynced} | Last ID: ${currentLastId}`)

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Total added this run: ${totalSynced}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
