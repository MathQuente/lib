import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { BATCH_SIZE, DELAY_MS, sleep } from './utils'

async function main() {
  const repo = new GameCacheRepository()

  const lastId = await repo.getMaxIgdbId()
  const existingCount = await repo.count()

  console.log(`Games already cached: ${existingCount}`)
  console.log(`Starting from IGDB id > ${lastId}`)
  console.log(
    'Press Ctrl+C to stop (safe — next run resumes from where it stopped)\n'
  )

  let totalSynced = 0
  let currentLastId = lastId
  let batch = 0

  while (true) {
    batch++
    const games = await IGDBService.fetchForSync(currentLastId, BATCH_SIZE)

    if (games.length === 0) {
      console.log('\nSync complete — no more games.')
      break
    }

    await repo.upsertMany(games.map(g => IGDBService.toGameCacheInput(g)))

    currentLastId = games[games.length - 1].id
    totalSynced += games.length

    process.stdout.write(
      `\rBatch ${batch} | +${games.length} games | Total: ${existingCount + totalSynced} | Last ID: ${currentLastId}`
    )

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Total synced this run: ${totalSynced}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
