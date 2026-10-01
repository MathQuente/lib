import { Worker } from 'bullmq'
import { bullConnection } from '../queues/connection'
import {
  PSN_IMPORT_QUEUE_NAME,
  PsnImportJobData
} from '../queues/psn-import.queue'
import { PsnService } from '../services/psn.service'
import { PsnApiService } from '../services/psn-api.service'
import { PsnAuthService } from '../services/psn-auth.service'
import { UserRepository } from '../repositories/users.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { ClientError } from '../errors/client-error'
import { withTimeout } from '../utils/with-timeout'

const GENERIC_IMPORT_ERROR =
  'Erro ao importar sua biblioteca da PlayStation. Tente novamente mais tarde.'

const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

export function startPsnImportWorker() {
  const psnService = new PsnService(
    new UserRepository(),
    new GameCacheService(new GameCacheRepository()),
    new PsnApiService(new PsnAuthService(new CacheRepository()))
  )

  const worker = new Worker(
    PSN_IMPORT_QUEUE_NAME,
    async job => {
      const { userId } = job.data as PsnImportJobData
      try {
        return await withTimeout(
          psnService.runImport(userId, percent => job.updateProgress(percent)),
          IMPORT_TIMEOUT_MS,
          'PSN import timed out after 5 minutes.'
        )
      } catch (err) {
        if (err instanceof ClientError) throw err
        console.error('[PsnImport] unexpected job failure', {
          jobId: job.id,
          error: err
        })
        throw new Error(GENERIC_IMPORT_ERROR)
      }
    },
    { connection: bullConnection }
  )

  worker.on('failed', (job, err) => {
    console.error('[PsnImport] job failed', {
      jobId: job?.id,
      error: err.message
    })
  })

  return worker
}
