import { Queue } from 'bullmq'
import { bullConnection } from './connection'
import { ImportSectionResult } from './import-job'

export const XBOX_IMPORT_QUEUE_NAME = 'xbox-import'

export const xboxImportQueue = new Queue(XBOX_IMPORT_QUEUE_NAME, {
  connection: bullConnection
})

export function xboxImportJobId(userId: string) {
  return `xbox-import-${userId}`
}

export interface XboxImportJobData {
  userId: string
}

export interface XboxImportJobResult {
  library: ImportSectionResult
}
