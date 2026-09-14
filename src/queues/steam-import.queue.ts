import { Queue } from 'bullmq'
import { bullConnection } from './connection'

export const STEAM_IMPORT_QUEUE_NAME = 'steam-import'

export const steamImportQueue = new Queue(STEAM_IMPORT_QUEUE_NAME, {
  connection: bullConnection
})

// Deterministic per-user id — doubles as the "only one import at a time"
// lock, since a second add() with the same jobId while one is still
// waiting/active/delayed is what enqueueImport checks for.
export function steamImportJobId(userId: string) {
  return `steam-import-${userId}`
}

export interface SteamImportJobData {
  userId: string
}

export interface SteamImportSectionResult {
  imported: number
  skipped: number
  notFound: string[]
}

export interface SteamImportJobResult {
  library: SteamImportSectionResult
  wishlist: SteamImportSectionResult
}
