import { Queue } from 'bullmq'
import { bullConnection } from './connection'
import { ImportSectionResult } from './import-job'

export const STEAM_IMPORT_QUEUE_NAME = 'steam-import'

export const steamImportQueue = new Queue(STEAM_IMPORT_QUEUE_NAME, {
  connection: bullConnection
})

export function steamImportJobId(userId: string) {
  return `steam-import-${userId}`
}

export interface SteamImportJobData {
  userId: string
}

export type SteamImportSectionResult = ImportSectionResult

export interface SteamImportJobResult {
  library: SteamImportSectionResult
  wishlist: SteamImportSectionResult
}
