import { ClientError } from '../errors/client-error'
import { PlatformRepository } from '../repositories/platform.repository'

export class PlatformService {
  private readonly ITEMS_PER_PAGE = 14

  constructor(private platformRepository: PlatformRepository) {}

  async createPlatform(platformName: string) {
    // Search platforms to see if has another platform with same name
    const platformWithSameName = await this.platformRepository.findByName(
      platformName
    )

    // if yes, throw error to alert
    if (platformWithSameName) {
      throw new ClientError(
        'Another platform with the same name already exists'
      )
    }

    // get ID of platform created
    const { id } = await this.platformRepository.create(platformName)

    // return the ID
    return {
      platform: {
        id
      }
    }
  }

  async getPlatformById(platformId: string) {
    // Search the ID to see if the platform exist and get the platform
    const platform = await this.platformRepository.findById(platformId)

    // if not, throw error
    if (!platform) {
      throw new ClientError('Platform not found.')
    }

    // return object with the platform
    return {
      platform: {
        id: platform.id,
        platformName: platform.platformName,
        games: platform?.games.map(game => ({
          id: game.id,
          gameName: game.gameName,
          gameBanner: game.gameBanner
        })),
        gamesTotal: platform._count.games
      }
    }
  }

  async getAllPlatforms(pageIndex: number) {
    // search and get all platforms
    const platforms = await this.platformRepository.findAll({
      pageIndex,
      limit: this.ITEMS_PER_PAGE
    })

    //return object with all platforms
    return {
      platforms: platforms.map(platform => ({
        id: platform.id,
        platformName: platform.platformName,
        games: platform.games,
        gamesTotal: platform._count.games
      }))
    }
  }

  async updatePlatofrm(platformId: string, platformName: string) {
    const platformAlreadyExists = await this.platformRepository.findById(
      platformId
    )

    if (!platformAlreadyExists) {
      throw new ClientError('Platform not found.')
    }

    const platformWithSameName = await this.platformRepository.findByName(
      platformName
    )

    if (platformWithSameName) {
      throw new ClientError(
        'Another platform with the same name already exists'
      )
    }

    const platform = await this.platformRepository.update(
      platformId,
      platformName
    )

    return {
      platform: {
        id: platform.id,
        platformName: platform.platformName
      }
    }
  }

  async deletePlatform(platformId: string) {
    const platformHasBeenAlreadyDeleted =
      await this.platformRepository.findById(platformId)

    if (!platformHasBeenAlreadyDeleted) {
      throw new ClientError('This platform has been already deleted')
    }

    const platform = await this.platformRepository.delete(platformId)

    return {
      platform: {
        id: platform.id,
        platformName: platform.platformName
      }
    }
  }
}
