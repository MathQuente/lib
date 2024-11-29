import { CreateDlcDTO } from '../dtos/dlcs.dto'
import { ClientError } from '../errors/client-error'
import { DlcRepository } from '../repositories/dlcs.repository'
import { GameRepository } from '../repositories/games.repository'

export class DlcService {
  constructor(
    private dlcRepository: DlcRepository,
    private gameRepository: GameRepository
  ) {}

  async createDlc(gameId: string, data: CreateDlcDTO) {
    const gameAlreadyExist = await this.gameRepository.findById(gameId)

    if (!gameAlreadyExist) {
      throw new ClientError('This game has not found.')
    }

    const dlcWithSameNameAlreadyExist = await this.dlcRepository.findDlcByName(
      data.dlcName
    )

    if (dlcWithSameNameAlreadyExist) {
      throw new ClientError('Another dlc with same name already used')
    }

    const dlc = await this.dlcRepository.createDlc(gameId, {
      categories: data.categories,
      dlcBanner: data.dlcBanner,
      dlcName: data.dlcName,
      gameStudios: data.gameStudios,
      platforms: data.platforms,
      publishers: data.publishers,
      summary: data.summary
    })

    return {
      dlc: {
        id: dlc.id,
        dlcName: dlc.dlcName
      }
    }
  }
}
