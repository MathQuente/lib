import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBRequestError } from '../errors/igdb-request-error'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import { BATCH_SIZE, sleep } from './utils'

const CONCURRENCY = 4
const MIN_ROUND_MS = 1000
const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 2000

const hiddenOnly = process.argv.includes('--hidden-only')

function parseFromArg(): number {
  const index = process.argv.indexOf('--from')
  if (index === -1) return 0
  const value = Number(process.argv[index + 1])
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('--from must be a non-negative integer IGDB id')
  }
  return value
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof IGDBRequestError) || attempt >= MAX_ATTEMPTS) {
        throw err
      }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

async function main() {
  const repo = new GameCacheRepository()

  let lastId = parseFromArg()
  let totalUpdated = 0
  let round = 0

  console.log(
    hiddenOnly
      ? `Refreshing game_status of hidden games (Cancelled, Rumored) with igdb_id > ${lastId}...`
      : `Backfilling game_status for cached games with igdb_id > ${lastId}...`
  )
  console.log(
    'Press Ctrl+C to stop, then resume with: npm run backfill:game-status -- --from <Last ID>\n'
  )

  while (true) {
    round++
    const startedAt = Date.now()
    const limit = BATCH_SIZE * CONCURRENCY
    const igdbIds = hiddenOnly
      ? await repo.findHiddenStatusIdsAfter(lastId, limit)
      : await repo.findIgdbIdsAfter(lastId, limit)

    if (igdbIds.length === 0) {
      console.log(
        hiddenOnly
          ? '\nRefresh complete — no more hidden games.'
          : '\nBackfill complete — no more cached games.'
      )
      break
    }

    const chunks: number[][] = []
    for (let i = 0; i < igdbIds.length; i += BATCH_SIZE) {
      chunks.push(igdbIds.slice(i, i + BATCH_SIZE))
    }

    await mapWithConcurrency(chunks, CONCURRENCY, async chunk => {
      const statusMap = await withRetry(() =>
        IGDBService.getGameStatusByIds(chunk)
      )
      await repo.updateGameStatuses(
        chunk
          .filter(igdbId => statusMap.has(igdbId))
          .map(igdbId => ({ igdbId, gameStatus: statusMap.get(igdbId)! }))
      )
    })

    lastId = igdbIds[igdbIds.length - 1]
    totalUpdated += igdbIds.length
    process.stdout.write(
      `\rRound ${round} | +${igdbIds.length} games | Total updated: ${totalUpdated} | Last ID: ${lastId}`
    )

    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_ROUND_MS) await sleep(MIN_ROUND_MS - elapsed)
  }

  console.log(`\nDone. Total updated this run: ${totalUpdated}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
