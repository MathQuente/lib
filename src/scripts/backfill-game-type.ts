import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBRequestError } from '../errors/igdb-request-error'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import { BATCH_SIZE, parseIntArg, sleep } from './utils'

const CONCURRENCY = 4
const MIN_ROUND_MS = 1000
const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 2000

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

  const dryRun = process.argv.includes('--dry-run')
  const limit = parseIntArg('--limit')
  const firstId = parseIntArg('--from') ?? 0
  let lastId = firstId
  let scanned = 0
  let known = 0
  let unknown = 0
  let round = 0
  const byType = new Map<number, number>()

  console.log(
    `${dryRun ? '[dry run] ' : ''}Backfilling category (IGDB game_type) for cached games with category = -1 and igdb_id > ${firstId}${limit !== undefined ? `, up to ${limit} games` : ''}...`
  )
  console.log(
    'Press Ctrl+C to stop, then resume with: npm run backfill:game-type -- --from <Last ID>\n'
  )

  while (limit === undefined || scanned < limit) {
    round++
    const startedAt = Date.now()
    const take = Math.min(
      BATCH_SIZE * CONCURRENCY,
      limit === undefined ? Infinity : limit - scanned
    )
    const igdbIds = await repo.findIdsWithUnknownCategoryAfter(lastId, take)

    if (igdbIds.length === 0) {
      console.log('\nNo more cached games with an unknown category.')
      break
    }

    const chunks: number[][] = []
    for (let i = 0; i < igdbIds.length; i += BATCH_SIZE) {
      chunks.push(igdbIds.slice(i, i + BATCH_SIZE))
    }

    await mapWithConcurrency(chunks, CONCURRENCY, async chunk => {
      const typesMap = await withRetry(() =>
        IGDBService.getGameTypesByIds(chunk)
      )
      const updates = chunk
        .filter(igdbId => typesMap.has(igdbId))
        .map(igdbId => ({ igdbId, category: typesMap.get(igdbId)! }))
      for (const { category } of updates) {
        byType.set(category, (byType.get(category) ?? 0) + 1)
      }
      known += updates.length
      unknown += chunk.length - updates.length
      if (!dryRun) await repo.updateCategories(updates)
    })

    lastId = igdbIds[igdbIds.length - 1]
    scanned += igdbIds.length
    process.stdout.write(
      `\rRound ${round} | scanned ${scanned} | with game_type ${known} | without ${unknown} | Last ID: ${lastId}`
    )

    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_ROUND_MS) await sleep(MIN_ROUND_MS - elapsed)
  }

  console.log(
    `\nDone${dryRun ? ' (nothing written)' : ''}. Scanned ${scanned}, with game_type ${known}, without ${unknown}. Range: ids > ${firstId} up to ${lastId}.`
  )
  console.log(
    'By game_type:',
    JSON.stringify(Object.fromEntries([...byType].sort((a, b) => a[0] - b[0])))
  )
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
