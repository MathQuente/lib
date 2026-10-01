import { vi } from 'vitest'
import { UserRepository } from '../repositories/users.repository'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { UserGamePlatformService } from '../services/user-game-platform.service'

export interface FakePlatformRepository {
  findUserGameWithPlatforms: ReturnType<typeof vi.fn>
  savePlatform: ReturnType<typeof vi.fn>
}

export function fakePlatformService(userRepository: UserRepository) {
  const createdStatus = new Map<number, number>()
  const addGame = userRepository.addGameToUserLibrary
  if (addGame) {
    userRepository.addGameToUserLibrary = vi.fn(async data => {
      createdStatus.set(data.igdbId, data.statusIds)
      return addGame(data)
    })
  }

  const platformRepository: FakePlatformRepository = {
    findUserGameWithPlatforms: vi.fn(async (igdbId: number, userId: string) => {
      const existing = userRepository.findUserGame
        ? await userRepository.findUserGame(igdbId, userId)
        : null
      const statusId =
        existing?.UserGamesStatus?.id ?? createdStatus.get(igdbId)
      if (statusId === undefined) return null
      return {
        id: `ug-${igdbId}`,
        userGamesStatusId: statusId,
        completedAt: null,
        UserGameStats: null,
        platforms: []
      }
    }),
    savePlatform: vi.fn().mockResolvedValue(undefined)
  }

  const service = new UserGamePlatformService(
    platformRepository as unknown as UserGamePlatformRepository,
    userRepository
  )

  return { service, platformRepository }
}
