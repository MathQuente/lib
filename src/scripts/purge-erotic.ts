import 'dotenv/config'
import { prisma } from '../database/db'
import { EROTIC_EXCEPTION_IDS, IGDBService } from '../services/igdb.service'

const PAGE_SIZE = 500
const PAUSE_MS = 300
const SAMPLE_SIZE = 10

const apply = process.argv.includes('--apply')

async function listEroticIds() {
  const ids: number[] = []
  let lastId = 0

  while (true) {
    const page = await IGDBService.fetchEroticIds(lastId, PAGE_SIZE)
    if (page.length === 0) break
    ids.push(...page)
    lastId = page[page.length - 1]
    await new Promise(resolve => setTimeout(resolve, PAUSE_MS))
  }

  return ids
}

async function main() {
  const eroticIds = await listEroticIds()
  console.log(
    `IGDB lists ${eroticIds.length} games with the Erotic theme, not counting the ${EROTIC_EXCEPTION_IDS.length} approved exceptions.`
  )
  const keptInCache = await prisma.gameCache.count({
    where: { igdbId: { in: EROTIC_EXCEPTION_IDS } }
  })
  console.log(
    `${keptInCache} of the ${EROTIC_EXCEPTION_IDS.length} exceptions are in games_cache and are left alone.`
  )

  const cached = await prisma.gameCache.findMany({
    where: { igdbId: { in: eroticIds } },
    select: { igdbId: true, name: true }
  })
  const inLibraries = await prisma.userGame.count({
    where: { igdbId: { in: cached.map(game => game.igdbId) } }
  })

  console.log(`${cached.length} of them are in games_cache.`)
  console.log(
    `${inLibraries} library entries point at them; those rows are not touched.`
  )
  console.log(
    'Sample:',
    cached
      .slice(0, SAMPLE_SIZE)
      .map(game => game.name)
      .join(' | ')
  )

  if (!apply) {
    console.log('Dry run. Pass --apply to delete them from games_cache.')
    return
  }

  const { count } = await prisma.gameCache.deleteMany({
    where: { igdbId: { in: cached.map(game => game.igdbId) } }
  })
  console.log(`Deleted ${count} rows from games_cache.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
