import { ClientError } from '../errors/client-error'
import { GameStudioRepository } from '../repositories/gameStudio.repository'

export class GameStudioService {
  private readonly ITEMS_PER_PAGE = 14

  constructor(private gameStudioRepository: GameStudioRepository) {}

  async createGameStudio(studioName: string) {
    const gameStudioWithSameAlreadyExist =
      await this.gameStudioRepository.findByName(studioName)

    if (gameStudioWithSameAlreadyExist) {
      throw new ClientError(
        'Another game studio with the same name already exists'
      )
    }

    const { id } = await this.gameStudioRepository.create(studioName)

    return {
      gameStudio: {
        id
      }
    }
  }

  async getStudioById(gameStudioId: string, pageIndex: number) {
    const gameStudio = await this.gameStudioRepository.findById(gameStudioId, {
      pageIndex,
      limit: this.ITEMS_PER_PAGE
    })

    if (!gameStudio) {
      throw new ClientError('This game studio not exists')
    }

    return {
      id: gameStudio?.id,
      studioName: gameStudio?.studioName,
      gamesAmount: gameStudio.games.length,
      games: gameStudio.games.map(game => ({
        id: game.id,
        gameBanner: game.gameBanner,
        gameName: game.gameName,
        isDlc: game.isDlc
      }))
    }
  }

  async getAllStudios(pageIndex: number) {
    const gameStudios = await this.gameStudioRepository.findAll({
      pageIndex,
      limit: this.ITEMS_PER_PAGE
    })

    return {
      gameStudios: gameStudios.map(gameStudio => ({
        id: gameStudio.id,
        studioName: gameStudio.studioName,
        gamesAmount: gameStudio._count.games
      }))
    }
  }

  async updateStudio(gameStudioId: string, studioName: string) {
    const gameStudioAlreadyExist = await this.gameStudioRepository.findById(
      gameStudioId
    )

    if (!gameStudioAlreadyExist) {
      throw new ClientError('Studio not found.')
    }

    const gameStudioWithSameAlreadyExist =
      await this.gameStudioRepository.findByName(studioName)

    if (gameStudioWithSameAlreadyExist) {
      throw new ClientError(
        'Another game studio with the same name already exists'
      )
    }

    const gameStudio = await this.gameStudioRepository.update(
      gameStudioId,
      studioName
    )

    return {
      gameStudio: {
        id: gameStudio.id,
        studioName: gameStudio.studioName
      }
    }
  }

  async deleteStudio(gameStudioId: string) {
    const gameStudioAlreadyExist = await this.gameStudioRepository.findById(
      gameStudioId
    )

    if (!gameStudioAlreadyExist) {
      throw new ClientError('this studio has been deleted')
    }

    const gameStudio = await this.gameStudioRepository.delete(gameStudioId)

    return {
      gameStudio: {
        id: gameStudio.id,
        studioName: gameStudio.studioName
      }
    }
  }
}
