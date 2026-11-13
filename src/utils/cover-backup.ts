import { isValidCoverUrl } from './cover-url-change'

export interface CoverBackupRow {
  igdbId: number
  previous: string | null
  next: string
}

export function formatCoverBackup(rows: CoverBackupRow[]): string {
  return rows.map(r => JSON.stringify(r)).join('\n')
}

export function parseCoverBackup(text: string): CoverBackupRow[] {
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        throw new Error(`Invalid backup line: "${line}"`)
      }
      const row = value as Partial<CoverBackupRow>
      if (
        !Number.isInteger(row.igdbId) ||
        typeof row.next !== 'string' ||
        !isValidCoverUrl(row.next) ||
        !(
          row.previous === null ||
          (typeof row.previous === 'string' && row.previous !== '')
        )
      ) {
        throw new Error(`Invalid backup line: "${line}"`)
      }
      return {
        igdbId: row.igdbId as number,
        previous: row.previous as string | null,
        next: row.next
      }
    })
}
