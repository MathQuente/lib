import { prisma } from '../database/db'

export class GameLauncherRepository {
  async createReleaseDate(
    gameId: string,
    dateRelease: Date,
    platformId: string
  ) {
    return prisma.gameLauncher.create({
      data: {
        dateRelease,
        gameId,
        platformId
      },
      select: {
        dateRelease: true,
        platforms: {
          select: {
            id: true,
            platformName: true
          }
        }
      }
    })
  }

  async findByGameAndPlatform(gameId: string, platformId: string) {
    return prisma.gameLauncher.findUnique({
      where: {
        platformId_gameId: {
          gameId,
          platformId
        }
      },
      select: {
        dateRelease: true,
        releasePeriod: true,
        platforms: {
          select: {
            id: true,
            platformName: true
          }
        }
      }
    })
  }
}
