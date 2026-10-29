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
  'Erro ao importar sua biblioteca do Xbox. Tente novamente mais tarde.'

const IMPORT_TIMEOUT_MS = 10 * 60 * 1000

export function startXboxImportWorker() {
  const userRepository = new UserRepository()
  const gameCacheService = new GameCacheService(new GameCacheRepository())
  const userService = new UserService(
    userRepository,
    new RatingRepository(),
    gameCacheService,
    new FollowRepository()
  )
  const xboxService = new XboxService(
    userRepository,
    gameCacheService,
    new XboxApiService(),
    new UserGamePlatformService(new UserGamePlatformRepository(), userRepository),
    undefined,
    new CompletionSuggestionService(
      new CompletionSuggestionRepository(),
      userService,
      new UserGamePlatformRepository()
    )
  )

  const worker = new Worker(
    XBOX_IMPORT_QUEUE_NAME,
    async job => {
      const { userId } = job.data as XboxImportJobData
      try {
        return await withTimeout(
          xboxService.runImport(userId, percent => job.updateProgress(percent)),
          IMPORT_TIMEOUT_MS,
          'Xbox import timed out after 10 minutes.'
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
