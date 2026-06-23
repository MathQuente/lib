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

  const lastId = await repo.getMaxIgdbId()
  const existingCount = await repo.count()

  console.log(`Games already cached: ${existingCount}`)
  console.log(`Starting from IGDB id > ${lastId}`)
  console.log('Press Ctrl+C to stop (safe — next run resumes from where it stopped)\n')

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

    const INT4_MAX = 2_147_483_647
    await repo.upsertMany(
      games.map(g => ({
        igdbId: g.id,
        name: g.name,
        coverUrl: IGDBService.formatCoverUrl(g.cover?.url),
        summary: g.summary,
        genres: g.genres?.map(x => x.name) ?? [],
        platforms: g.platforms?.map(x => x.name) ?? [],
        releaseDate:
          g.first_release_date && g.first_release_date <= INT4_MAX
            ? g.first_release_date
            : undefined
      }))
    )

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
