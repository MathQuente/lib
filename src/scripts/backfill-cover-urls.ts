import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { prisma } from '../database/db'
import { IGDBService } from '../services/igdb.service'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { mapWithConcurrency } from '../utils/map-with-concurrency'
import {
  CoverUrlChangeKind,
  classifyCoverUrlChange
} from '../utils/cover-url-change'
import {
  CoverBackupRow,
  formatCoverBackup,
  parseCoverBackup
} from '../utils/cover-backup'
import {
  BATCH_SIZE,
  parseIdsArg,
  parseIntArg,
  parseStringArg,
  sleep,
  withRetry,
  writeBackupFile
} from './utils'

const CONCURRENCY = 4
const MIN_ROUND_MS = 1000
const SAMPLES_PER_KIND = 10
const DAY_SECONDS = 86_400

const LABELS: Record<CoverUrlChangeKind, string> = {
  igual: 'iguais',
  trocada_imagem: 'imagem trocada (id da imagem diferente)',
  trocada_formato: 'só o formato da URL mudou (mesmo id de imagem)',
  ganha: 'sem capa no cache e com capa no IGDB',
  removida_ignorada: 'IGDB sem capa (mantém a do cache, ignorados)',
  url_invalida_ignorada: 'URL do IGDB inválida (ignorados)'
}

interface Change {
  igdbId: number
  name: string
  kind: CoverUrlChangeKind
  writes: boolean
  previous: string | null
  next: string | null
}

function tail(url: string | null) {
  return url === null ? 'sem capa' : (url.split('/').pop() ?? url)
}

function describe(change: Change) {
  return `${change.igdbId} ${change.name.slice(0, 40)}: ${tail(change.previous)} -> ${tail(change.next)} [${change.kind}${change.writes ? '' : ', não grava'}]`
}

async function restore(
  repo: GameCacheRepository,
  file: string,
  dryRun: boolean
) {
  const rows = parseCoverBackup(readFileSync(file, 'utf8'))
  const affected = await repo.restoreCoverUrls(rows, dryRun)
  console.log(
    `${dryRun ? '[dry run] ' : ''}${rows.length} linhas no backup, ${affected} ${dryRun ? 'seriam restauradas' : 'restauradas'} (só onde a capa ainda é a gravada pelo backfill). Com mais de um backup da mesma capa, restaure do mais novo para o mais antigo.`
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

  const all = process.argv.includes('--all')
  const sinceDays = parseIntArg('--since-days') ?? 365
  const maxChanges = parseIntArg('--max-changes')
  const firstId = parseIntArg('--from') ?? 0
  const show = new Set(parseIdsArg('--show'))
  const sinceEpoch = all
    ? null
    : Math.floor(Date.now() / 1000) - sinceDays * DAY_SECONDS

  console.log(
    `${dryRun ? '[dry run] ' : ''}Comparando cover_url do cache com o IGDB: ${all ? 'catálogo inteiro' : `jogos com data dos últimos ${sinceDays} dias e futura`}, igdb_id > ${firstId}.\n`
  )

  const counts = new Map<CoverUrlChangeKind, number>()
  const samples = new Map<CoverUrlChangeKind, Change[]>()
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
    const candidates = await repo.findCoverCandidatesAfter(
      lastId,
      BATCH_SIZE * CONCURRENCY,
      sinceEpoch
    )
    if (candidates.length === 0) break

    const chunks: (typeof candidates)[] = []
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      chunks.push(candidates.slice(i, i + BATCH_SIZE))
    }

    await mapWithConcurrency(chunks, CONCURRENCY, async chunk => {
      const covers = await withRetry(() =>
        IGDBService.getCoverUrlsByIds(chunk.map(c => c.igdbId))
      )
      for (const candidate of chunk) {
        if (show.size > 0) seen.add(candidate.igdbId)
        if (!covers.has(candidate.igdbId)) {
          notReturned++
          continue
        }
        const result = classifyCoverUrlChange({
          cacheCoverUrl: candidate.coverUrl,
          igdbCoverUrl: covers.get(candidate.igdbId) ?? null
        })
        counts.set(result.kind, (counts.get(result.kind) ?? 0) + 1)
        const change: Change = {
          igdbId: candidate.igdbId,
          name: candidate.name,
          kind: result.kind,
          writes: result.writes,
          previous: candidate.coverUrl,
          next: result.newCoverUrl
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
      `  ${String(counts.get(kind as CoverUrlChangeKind) ?? 0).padStart(6)}  ${label}`
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
  const backupFile = `backfill-cover-urls-${stamp}.jsonl`
  const backupRows: CoverBackupRow[] = toApply.map(c => ({
    igdbId: c.igdbId,
    previous: c.previous,
    next: c.next as string
  }))
  writeBackupFile(backupFile, formatCoverBackup(backupRows) + '\n')
  console.log(`\nBackup gravado: ${backupFile} (${backupRows.length} linhas).`)

  let written = 0
  for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
    written += await repo.updateCoverUrls(
      toApply
        .slice(i, i + BATCH_SIZE)
        .map(c => ({ igdbId: c.igdbId, coverUrl: c.next as string }))
    )
  }
  console.log(
    `Gravadas ${written} de ${toApply.length} linhas (só a coluna cover_url).`
  )
  console.log(
    `Para desfazer: npm run backfill:cover-urls -- --restore ${backupFile}`
  )
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
