import { Worker } from 'bullmq'
import { bullConnection } from '../queues/connection'
import {
  STEAM_IMPORT_QUEUE_NAME,
  SteamImportJobData
} from '../queues/steam-import.queue'
import { SteamService } from '../services/steam.service'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { ClientError } from '../errors/client-error'

const GENERIC_IMPORT_ERROR =
  'Erro ao importar sua biblioteca da Steam. Tente novamente mais tarde.'

const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      error => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

export function startSteamImportWorker() {
  const userRepository = new UserRepository()
  const gameCacheService = new GameCacheService(new GameCacheRepository())
  const steamService = new SteamService(userRepository, gameCacheService)

  const worker = new Worker(
    STEAM_IMPORT_QUEUE_NAME,
    async job => {
      const { userId } = job.data as SteamImportJobData
      try {
        return await withTimeout(
          steamService.runImport(userId, percent =>
            job.updateProgress(percent)
          ),
          IMPORT_TIMEOUT_MS,
          'Steam import timed out after 5 minutes.'
        )
      } catch (err) {
        if (err instanceof ClientError) throw err
        console.error('[SteamImport] unexpected job failure', {
          jobId: job.id,
          error: err
        })
        throw new Error(GENERIC_IMPORT_ERROR)
      }
    },
    { connection: bullConnection }
  )

  worker.on('failed', (job, err) => {
    console.error('[SteamImport] job failed', {
      jobId: job?.id,
      error: err.message
    })
  })

  return worker
}
