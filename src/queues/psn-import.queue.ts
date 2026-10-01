import { Queue } from 'bullmq'
import { bullConnection } from './connection'
import { ImportSectionResult } from './import-job'

export const PSN_IMPORT_QUEUE_NAME = 'psn-import'

export const psnImportQueue = new Queue(PSN_IMPORT_QUEUE_NAME, {
  connection: bullConnection
})

export function psnImportJobId(userId: string) {
  return `psn-import-${userId}`
}

export interface PsnImportJobData {
  userId: string
}

export interface PsnImportJobResult {
  library: ImportSectionResult
}
