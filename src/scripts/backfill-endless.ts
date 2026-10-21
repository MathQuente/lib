import 'dotenv/config'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'

const PAGE_SIZE = 1000
const UPDATE_CHUNK_SIZE = 5000
const MAX_EMPTY_MODES_SHARE = 0.5

async function main() {
  const apply = process.argv.includes('--apply')

  console.log(
    apply
      ? 'APPLY mode: turning endless on for the library rows listed below.\n'
      : 'DRY RUN: nothing is written. Pass --apply to write.\n'
  )

  const [cachedTotal, cachedWithoutModes] = await Promise.all([
    prisma.gameCache.count(),
    prisma.gameCache.count({ where: { gameModes: { isEmpty: true } } })
  ])
  if (
    cachedTotal > 0 &&
    cachedWithoutModes / cachedTotal > MAX_EMPTY_MODES_SHARE
  ) {
    console.warn(
      `WARNING: ${cachedWithoutModes} of ${cachedTotal} cached games have no game_modes. Run npm run backfill:game-modes first, or only name-pattern matches will be found.\n`
    )
  }

  let cursor: string | undefined
  let scanned = 0
  const toChange: {
    id: string
    userId: string
    igdbId: number
    name: string
  }[] = []

  while (true) {
    const rows = await prisma.userGame.findMany({
      where: { endless: false, endlessLocked: false },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, userId: true, igdbId: true }
    })
    if (rows.length === 0) break

    const cached = await prisma.gameCache.findMany({
      where: { igdbId: { in: rows.map(r => r.igdbId) } },
      select: { igdbId: true, name: true, gameModes: true }
    })
    const cacheById = new Map(cached.map(c => [c.igdbId, c]))

    for (const row of rows) {
      const game = cacheById.get(row.igdbId)
      if (game && IGDBService.suggestsEndless(game)) {
        toChange.push({
          id: row.id,
          userId: row.userId,
          igdbId: row.igdbId,
          name: game.name
        })
      }
    }

    scanned += rows.length
    cursor = rows[rows.length - 1].id
  }

  const byGame = new Map<string, number>()
  for (const row of toChange) {
    const key = `${row.igdbId} ${row.name}`
    byGame.set(key, (byGame.get(key) ?? 0) + 1)
  }

  console.log(`Library rows scanned (unlocked, endless off): ${scanned}`)
  console.log(
    `Rows that would turn endless on: ${toChange.length} (${new Set(toChange.map(r => r.userId)).size} users, ${byGame.size} games)\n`
  )
  for (const [game, count] of [...byGame].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x  ${game}`)
  }

  if (apply && toChange.length > 0) {
    let updated = 0
    for (let i = 0; i < toChange.length; i += UPDATE_CHUNK_SIZE) {
      const result = await prisma.userGame.updateMany({
        where: {
          id: { in: toChange.slice(i, i + UPDATE_CHUNK_SIZE).map(r => r.id) },
          endless: false,
          endlessLocked: false
        },
        data: { endless: true }
      })
      updated += result.count
    }
    console.log(`\nUpdated ${updated} rows.`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
