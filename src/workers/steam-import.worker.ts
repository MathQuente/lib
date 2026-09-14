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

// Raised from 2min: achievement checks add one HTTP call per played game,
// run with limited concurrency, so large libraries need more headroom.
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

// Runs in the same process as the Fastify server (no separate worker
// deployment) — a personal-project-scale tradeoff, see design notes.
export function startSteamImportWorker() {
  const userRepository = new UserRepository()
  const gameCacheService = new GameCacheService(new GameCacheRepository())
  const steamService = new SteamService(userRepository, gameCacheService)

  const worker = new Worker(
    STEAM_IMPORT_QUEUE_NAME,
    async job => {
      const { userId } = job.data as SteamImportJobData
      // Per-request HTTP timeouts (fetchWithTimeout) handle a single hung
      // call; this is the ceiling for the whole import, so a stuck job can
      // never leave the "Importar" button disabled forever.
      return withTimeout(
        steamService.runImport(userId),
        IMPORT_TIMEOUT_MS,
        'Steam import timed out after 5 minutes.'
      )
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
