import { Worker } from 'bullmq'
import { bullConnection } from '../queues/connection'
import {
  XBOX_IMPORT_QUEUE_NAME,
  XboxImportJobData
} from '../queues/xbox-import.queue'
import { XboxService } from '../services/xbox.service'
import { XboxApiService } from '../services/xbox-api.service'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { ClientError } from '../errors/client-error'
import { withTimeout } from '../utils/with-timeout'

const GENERIC_IMPORT_ERROR =
  'Erro ao importar sua biblioteca do Xbox. Tente novamente mais tarde.'

const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

export function startXboxImportWorker() {
  const xboxService = new XboxService(
    new UserRepository(),
    new GameCacheService(new GameCacheRepository()),
    new XboxApiService()
  )

  const worker = new Worker(
    XBOX_IMPORT_QUEUE_NAME,
    async job => {
      const { userId } = job.data as XboxImportJobData
      try {
        return await withTimeout(
          xboxService.runImport(userId, percent => job.updateProgress(percent)),
          IMPORT_TIMEOUT_MS,
          'Xbox import timed out after 5 minutes.'
        )
      } catch (err) {
        if (err instanceof ClientError) throw err
        console.error('[XboxImport] unexpected job failure', {
          jobId: job.id,
          error: err
        })
        throw new Error(GENERIC_IMPORT_ERROR)
      }
    },
    { connection: bullConnection }
  )

  worker.on('failed', (job, err) => {
    console.error('[XboxImport] job failed', {
      jobId: job?.id,
      error: err.message
    })
  })

  return worker
}
