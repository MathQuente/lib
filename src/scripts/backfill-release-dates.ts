import 'dotenv/config'
import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeSync
} from 'node:fs'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import {
  ReleaseDateChangeKind,
  classifyReleaseDateChange
} from '../utils/release-date-change'
import {
  ReleaseDateBackupRow,
  formatReleaseDateBackup,
  parseReleaseDateBackup
} from '../utils/release-date-backup'
import { BATCH_SIZE, parseIntArg, sleep, withRetry } from './utils'

const CONCURRENCY = 4
const MIN_ROUND_MS = 1000
const SAMPLES_PER_KIND = 10
const DAY_SECONDS = 86_400

const LABELS: Record<ReleaseDateChangeKind, string> = {
  igual: 'iguais',
  ja_lancado: 'já lançados no IGDB (cache ainda como futuro)',
  outra_data_futura: 'outra data futura',
  adiado_para_o_futuro: 'adiados para o futuro (cache como já lançado)',
  outra_data_passada: 'outra data passada',
  data_removida: 'data removida e IGDB diz lançado (grava NULL)',
  data_removida_ignorada: 'data removida mas IGDB não diz lançado (ignorados)',
  data_adicionada: 'sem data no cache e com data no IGDB'
}

interface Change {
  igdbId: number
  name: string
  kind: ReleaseDateChangeKind
  writes: boolean
  previous: number | null
  next: number | null
}

function day(epoch: number | null) {
  return epoch === null
    ? 'sem data'
    : new Date(epoch * 1000).toISOString().slice(0, 10)
}

function parseIdsArg(flag: string): number[] {
  const index = process.argv.indexOf(flag)
  if (index === -1) return []
  return (process.argv[index + 1] ?? '')
    .split(',')
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0)
}

function parseStringArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

function describe(change: Change) {
  return `${change.igdbId} ${change.name.slice(0, 40)}: ${day(change.previous)} -> ${day(change.next)} [${change.kind}${change.writes ? '' : ', não grava'}]`
}

async function restore(
  repo: GameCacheRepository,
  file: string,
  dryRun: boolean
) {
  const rows = parseReleaseDateBackup(readFileSync(file, 'utf8'))
  const affected = await repo.restoreReleaseDates(rows, dryRun)
  console.log(
    `${dryRun ? '[dry run] ' : ''}${rows.length} linhas no backup, ${affected} ${dryRun ? 'seriam restauradas' : 'restauradas'} (só onde a data ainda é a gravada pelo backfill).`
  )
}

async function main() {
  const repo = new GameCacheRepository()
  const dryRun = process.argv.includes('--dry-run')
  const restoreFile = parseStringArg('--restore')

  if (restoreFile) {
    await restore(repo, restoreFile, dryRun)
    await prisma.$disconnect()
    return
  }

  const includeUndated = process.argv.includes('--include-undated')
  if (includeUndated && !dryRun) {
    throw new Error('--include-undated só vale com --dry-run (medição)')
  }
  const sinceDays = parseIntArg('--since-days') ?? 365
  const maxChanges = parseIntArg('--max-changes')
  const firstId = parseIntArg('--from') ?? 0
  const show = new Set(parseIdsArg('--show'))
  const nowEpoch = Math.floor(Date.now() / 1000)
  const sinceEpoch = nowEpoch - sinceDays * DAY_SECONDS

  console.log(
    `${dryRun ? '[dry run] ' : ''}Comparando release_date do cache com o IGDB: data futura${sinceDays > 0 ? ` e dos últimos ${sinceDays} dias` : ''}${includeUndated ? ', mais as sem data' : ''}, igdb_id > ${firstId}.\n`
  )

  const counts = new Map<ReleaseDateChangeKind, number>()
  const samples = new Map<ReleaseDateChangeKind, Change[]>()
  const changes: Change[] = []
  const shown = new Map<number, Change>()
  const seen = new Set<number>()
  let scanned = 0
  let notReturned = 0
  let lastId = firstId
  let round = 0

  while (true) {
    round++
    const startedAt = Date.now()
    const candidates = await repo.findReleaseDateCandidatesAfter(
      lastId,
      BATCH_SIZE * CONCURRENCY,
      sinceEpoch,
      includeUndated
    )
    if (candidates.length === 0) break

    const chunks: (typeof candidates)[] = []
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      chunks.push(candidates.slice(i, i + BATCH_SIZE))
    }

    await mapWithConcurrency(chunks, CONCURRENCY, async chunk => {
      const info = await withRetry(() =>
        IGDBService.getReleaseInfoByIds(chunk.map(c => c.igdbId))
      )
      for (const candidate of chunk) {
        seen.add(candidate.igdbId)
        const igdb = info.get(candidate.igdbId)
        if (!igdb) {
          notReturned++
          continue
        }
        const result = classifyReleaseDateChange({
          cacheReleaseDate: IGDBService.toCacheReleaseDate(
            candidate.releaseDate
          ),
          igdbReleaseDate: igdb.releaseDate,
          igdbGameStatus: igdb.gameStatus,
          nowEpoch
        })
        counts.set(result.kind, (counts.get(result.kind) ?? 0) + 1)
        const change: Change = {
          igdbId: candidate.igdbId,
          name: candidate.name,
          kind: result.kind,
          writes: result.writes,
          previous: candidate.releaseDate,
          next: result.newReleaseDate
        }
        if (show.has(change.igdbId)) shown.set(change.igdbId, change)
        if (result.kind === 'igual') continue
        const bucket = samples.get(result.kind) ?? []
        if (bucket.length < SAMPLES_PER_KIND) bucket.push(change)
        samples.set(result.kind, bucket)
        if (result.writes) changes.push(change)
      }
    })

    lastId = candidates[candidates.length - 1].igdbId
    scanned += candidates.length
    process.stdout.write(
      `\rRodada ${round} | lidas ${scanned} | Último ID: ${lastId}`
    )

    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_ROUND_MS) await sleep(MIN_ROUND_MS - elapsed)
  }

  changes.sort((a, b) => a.igdbId - b.igdbId)
  console.log(
    `\n\nLinhas lidas: ${scanned} | não retornadas pelo IGDB: ${notReturned}`
  )
  for (const [kind, label] of Object.entries(LABELS)) {
    console.log(
      `  ${String(counts.get(kind as ReleaseDateChangeKind) ?? 0).padStart(6)}  ${label}`
    )
  }
  console.log(`\nLinhas que mudam: ${changes.length}`)

  for (const [kind, bucket] of samples) {
    console.log(`\nAmostra (${LABELS[kind]}):`)
    for (const change of bucket) console.log(`  ${describe(change)}`)
  }
  for (const id of show) {
    console.log(
      `\n--show ${id}: ${shown.get(id) ? describe(shown.get(id)!) : seen.has(id) ? 'não retornado pelo IGDB' : 'fora da seleção'}`
    )
  }

  const flipsReleased = changes
    .filter(c => c.kind === 'adiado_para_o_futuro' || c.kind === 'ja_lancado')
    .map(c => c.igdbId)
  const withUserData = await repo.findIgdbIdsWithRatingOrReview(flipsReleased)
  console.log(
    `\nJogos que trocam de "lançado" para "não lançado" (ou o contrário) e já têm nota ou avaliação: ${withUserData.size} de ${flipsReleased.length}`
  )

  if (dryRun) {
    console.log('\nDry run: nada foi gravado.')
    await prisma.$disconnect()
    return
  }

  const toApply =
    maxChanges === undefined ? changes : changes.slice(0, maxChanges)
  if (toApply.length === 0) {
    console.log('\nNada a gravar.')
    await prisma.$disconnect()
    return
  }

  const stamp = new Date()
    .toISOString()
    .replace(/\.\d+Z$/, '')
    .replace(/:/g, '-')
  const backupFile = `backfill-release-dates-${stamp}.csv`
  const backupRows: ReleaseDateBackupRow[] = toApply.map(c => ({
    igdbId: c.igdbId,
    previous: c.previous,
    next: c.next
  }))
  const fd = openSync(backupFile, 'wx')
  writeSync(fd, formatReleaseDateBackup(backupRows) + '\n')
  fsyncSync(fd)
  closeSync(fd)
  console.log(`\nBackup gravado: ${backupFile} (${backupRows.length} linhas).`)

  let written = 0
  for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
    written += await repo.updateReleaseDates(
      toApply
        .slice(i, i + BATCH_SIZE)
        .map(c => ({ igdbId: c.igdbId, releaseDate: c.next }))
    )
  }
  console.log(
    `Gravadas ${written} de ${toApply.length} linhas (só a coluna release_date).`
  )
  console.log(
    `Para desfazer: npm run backfill:release-dates -- --restore ${backupFile}`
  )
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
