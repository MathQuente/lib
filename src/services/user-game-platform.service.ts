import { Platform } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import {
  PlatformValues,
  UserGamePlatformRepository
} from '../repositories/user-game-platform.repository'
import { UserRepository } from '../repositories/users.repository'

const PLAYED_STATUS_ID = 1
const WISHLIST_STATUS_ID = 5

const STATUS_RANK: Record<number, number> = {
  5: 0,
  4: 1,
  2: 2,
  3: 3,
  1: 4
}

export interface ImportedPlatformData {
  statusId: number
  hoursPlayed: number
  finished: boolean
  completedAt?: Date
}

export interface PlatformPatch {
  hoursPlayed?: number | null
  completions?: number
  completedAt?: string | null
}

type UserGameWithPlatforms = NonNullable<
  Awaited<ReturnType<UserGamePlatformRepository['findUserGameWithPlatforms']>>
>

function toDateString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null
}

function legacyValues(userGame: UserGameWithPlatforms): PlatformValues {
  const isPlayed = userGame.userGamesStatusId === PLAYED_STATUS_ID
  const legacyHours = userGame.UserGameStats?.hoursPlayed
  return {
    hoursPlayed: legacyHours != null ? Number(legacyHours) : null,
    completions: isPlayed ? (userGame.UserGameStats?.completions ?? 0) : 0,
    completedAt: isPlayed ? userGame.completedAt : null
  }
}

export class UserGamePlatformService {
  constructor(
    private platformRepository: UserGamePlatformRepository,
    private userRepository: UserRepository
  ) {}

  private async requireUserGame(igdbId: number, userId: string) {
    const userGame = await this.platformRepository.findUserGameWithPlatforms(
      igdbId,
      userId
    )
    if (!userGame) {
      throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
    }
    return userGame
  }

  private toResponse(userGame: UserGameWithPlatforms) {
    return {
      platforms: userGame.platforms.map(p => ({
        platform: p.platform,
        hoursPlayed: p.hoursPlayed != null ? Number(p.hoursPlayed) : null,
        completions: p.completions,
        completedAt: toDateString(p.completedAt)
      })),
      totals: {
        hoursPlayed: userGame.UserGameStats?.hoursPlayed
          ? Number(userGame.UserGameStats.hoursPlayed)
          : 0,
        completions: userGame.UserGameStats?.completions ?? 0,
        completedAt: toDateString(userGame.completedAt)
      }
    }
  }

  async getPlatforms(userId: string, igdbId: number) {
    return this.toResponse(await this.requireUserGame(igdbId, userId))
  }

  async addPlatform(userId: string, igdbId: number, platform: Platform) {
    const userGame = await this.requireUserGame(igdbId, userId)

    if (userGame.userGamesStatusId === WISHLIST_STATUS_ID) {
      throw new ClientError(
        'Não é possível definir plataformas para um jogo da lista de desejos.',
        400
      )
    }

    if (!userGame.platforms.some(p => p.platform === platform)) {
      const isPlayed = userGame.userGamesStatusId === PLAYED_STATUS_ID
      const inherited: PlatformValues =
        userGame.platforms.length === 0 ? legacyValues(userGame) : {}
      const values: PlatformValues = isPlayed
        ? {
            ...inherited,
            completions: Math.max(inherited.completions ?? 0, 1)
          }
        : inherited
      await this.platformRepository.savePlatform(userGame.id, platform, values)
    }

    return this.getPlatforms(userId, igdbId)
  }

  async updatePlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    patch: PlatformPatch
  ) {
    const userGame = await this.requireUserGame(igdbId, userId)

    if (!userGame.platforms.some(p => p.platform === platform)) {
      throw new ClientError('Plataforma não encontrada neste jogo.', 404)
    }

    const values: PlatformValues = {}

    if (patch.hoursPlayed !== undefined) values.hoursPlayed = patch.hoursPlayed
    if (patch.completions !== undefined) values.completions = patch.completions

    if (patch.completedAt !== undefined) {
      if (patch.completedAt !== null) {
        if (userGame.userGamesStatusId !== PLAYED_STATUS_ID) {
          throw new ClientError(
            'Só é possível definir a data de finalização para jogos marcados como Jogado.',
            400
          )
        }
        const parsed = new Date(`${patch.completedAt}T00:00:00.000Z`)
        if (parsed.getTime() > Date.now()) {
          throw new ClientError(
            'A data de finalização não pode ser no futuro.',
            400
          )
        }
        values.completedAt = parsed
      } else {
        values.completedAt = null
      }
    }

    await this.platformRepository.savePlatform(userGame.id, platform, values)

    return this.getPlatforms(userId, igdbId)
  }

  async removePlatform(userId: string, igdbId: number, platform: Platform) {
    const userGame = await this.requireUserGame(igdbId, userId)

    if (!userGame.platforms.some(p => p.platform === platform)) {
      throw new ClientError('Plataforma não encontrada neste jogo.', 404)
    }

    await this.platformRepository.deletePlatform(userGame.id, platform)

    return this.getPlatforms(userId, igdbId)
  }

  async importPlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    data: ImportedPlatformData
  ): Promise<'imported' | 'updated'> {
    let userGame = await this.platformRepository.findUserGameWithPlatforms(
      igdbId,
      userId
    )
    const isNew = !userGame

    if (!userGame) {
      await this.userRepository.addGameToUserLibrary({
        igdbId,
        userId,
        statusIds: data.statusId,
        completedAt: data.completedAt
      })
      await this.userRepository.createUserGameStats(userId, igdbId, 0)
      userGame = await this.requireUserGame(igdbId, userId)
    } else if (
      (STATUS_RANK[data.statusId] ?? 0) >
      (STATUS_RANK[userGame.userGamesStatusId] ?? 0)
    ) {
      await this.userRepository.updateGameStatus(igdbId, userId, data.statusId)
    }

    const existing = userGame.platforms.find(p => p.platform === platform)
    const base: PlatformValues = existing
      ? {
          completions: existing.completions,
          completedAt: existing.completedAt
        }
      : userGame.platforms.length === 0 && !isNew
        ? legacyValues(userGame)
        : { completions: 0, completedAt: null }

    await this.platformRepository.savePlatform(userGame.id, platform, {
      hoursPlayed: data.hoursPlayed,
      completions: data.finished
        ? Math.max(base.completions ?? 0, 1)
        : (base.completions ?? 0),
      completedAt:
        base.completedAt ??
        (data.finished ? (data.completedAt ?? new Date()) : null)
    })

    return isNew ? 'imported' : 'updated'
  }
}
