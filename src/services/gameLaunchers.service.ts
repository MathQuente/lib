import { ClientError } from '../errors/client-error'
import { GameLauncherRepository } from '../repositories/gameLaunchers.repository'
import { GameRepository } from '../repositories/games.repository'
import { PlatformRepository } from '../repositories/platforms.repository'

export class GameLauncherService {
  constructor(
    private gameRepository: GameRepository,
    private platformRepository: PlatformRepository,
    private gameLauncherRepository: GameLauncherRepository
  ) {}
  async createGameDateRelease(
    gameId: string,
    dateRelease: Date,
    platformId: string
  ) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('Game not found.', 404)
    }

    const platformAlreadyExist = await this.platformRepository.findById(
      platformId
    )

    if (!platformAlreadyExist) {
      throw new ClientError('Platform not found.', 404)
    }

    const gameDateIsAlreadyUsed =
      await this.gameLauncherRepository.findByGameAndPlatform(gameId, platformId)

    if (gameDateIsAlreadyUsed) {
      throw new ClientError('The game is already released in this date.', 409)
    }

    const gameDateRelease =
      await this.gameLauncherRepository.createReleaseDate(
        gameId,
        dateRelease,
        platformId
      )

    return {
      gameDateRelease: {
        dateRelease: gameDateRelease.dateRelease,
        platformId: gameDateRelease.platforms.id,
        platformName: gameDateRelease.platforms.platformName
      }
    }
  }
}
