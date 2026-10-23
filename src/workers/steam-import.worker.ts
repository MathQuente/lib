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
import { CompletionSuggestionRepository } from '../repositories/completion-suggestion.repository'
import { CompletionSuggestionService } from '../services/completion-suggestion.service'
import { FollowRepository } from '../repositories/follow.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { UserService } from '../services/users.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserGamePlatformService } from '../services/user-game-platform.service'
import { ClientError } from '../errors/client-error'
import { withTimeout } from '../utils/with-timeout'

const GENERIC_IMPORT_ERROR =
  'Erro ao importar sua biblioteca da Steam. Tente novamente mais tarde.'

const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

export function startSteamImportWorker() {
  const userRepository = new UserRepository()
  const gameCacheService = new GameCacheService(new GameCacheRepository())
  const userService = new UserService(
    userRepository,
    new RatingRepository(),
    gameCacheService,
    new FollowRepository()
  )
  const steamService = new SteamService(
    userRepository,
    gameCacheService,
    new UserGamePlatformService(new UserGamePlatformRepository(), userRepository),
    new CompletionSuggestionService(
      new CompletionSuggestionRepository(),
      userService,
      new UserGamePlatformRepository()
    )
  )

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
