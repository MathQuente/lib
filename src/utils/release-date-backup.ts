export interface ReleaseDateBackupRow {
  igdbId: number
  previous: number | null
  next: number | null
}

const HEADER = 'igdb_id,release_date_antiga,release_date_nova'

function field(value: number | null) {
  return value === null ? '' : String(value)
}

function parseField(text: string): number | null {
  if (text === '') return null
  const value = Number(text)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid release date in backup: "${text}"`)
  }
  return value
}

export function formatReleaseDateBackup(rows: ReleaseDateBackupRow[]): string {
  return [
    HEADER,
    ...rows.map(r => `${r.igdbId},${field(r.previous)},${field(r.next)}`)
  ].join('\n')
}

export function parseReleaseDateBackup(text: string): ReleaseDateBackupRow[] {
  const [header, ...lines] = text.split('\n').filter(l => l.trim() !== '')
  if (header?.trim() !== HEADER) {
    throw new Error('Not a release date backup file (unexpected header)')
  }
  return lines.map(line => {
    const [id, previous, next, ...extra] = line.trim().split(',')
    const igdbId = Number(id)
    if (!Number.isInteger(igdbId) || extra.length > 0 || next === undefined) {
      throw new Error(`Invalid backup line: "${line}"`)
    }
    return { igdbId, previous: parseField(previous), next: parseField(next) }
  })
}
