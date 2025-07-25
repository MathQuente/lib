import { UserGamesStatusRepository } from '../repositories/userGameStatus.repository'

export class UserGameStatusService {
  private readonly itemsPerPage = 36

  constructor(private userGameStatus: UserGamesStatusRepository) {}

  async findAllGameStatus() {
    const status = await this.userGameStatus.findManyGameStatus()

    return {
      status: status.map(currentStatus => ({
        id: currentStatus.id,
        status: currentStatus.status
      }))
    }
  }
}
