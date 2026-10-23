import { Console, Platform } from '@prisma/client'
import { ClientError } from '../errors/client-error'
import {
  PlatformValues,
  UserGamePlatformRepository
} from '../repositories/user-game-platform.repository'
import { UserRepository } from '../repositories/users.repository'
import { isConsoleAllowed } from '../utils/platform-consoles'

const PLAYED_STATUS_ID = 1
const WISHLIST_STATUS_ID = 5
const BACKLOG_STATUS_ID = 4
const PLAYING_STATUS_ID = 3

const STATUS_RANK: Record<number, number> = {
  5: 0,
  4: 1,
  2: 2,
  6: 2,
  3: 3,
  1: 4
}

export interface ImportedPlatformData {
  statusId: number
  activityStatusId: number
  hoursPlayed?: number
  finished: boolean
  confirmedFinished: boolean
  strongFinished?: boolean
  completedAt?: Date
  endless?: boolean
}

export interface PlatformPatch {
  hoursPlayed?: number | null
  completions?: number
  completedAt?: string | null
}

type UserGameWithPlatforms = NonNullable<
  Awaited<ReturnType<UserGamePlatformRepository['findUserGameWithPlatforms']>>
>

type PlatformRow = UserGameWithPlatforms['platforms'][number]

export type RowResolution =
  | { action: 'update'; row: PlatformRow }
  | { action: 'adopt'; row: PlatformRow }
  | { action: 'create' }
  | { action: 'skip' }

export function resolveRow(
  rows: PlatformRow[],
  platform: Platform,
  gameConsole: Console,
  options: { fromImport?: boolean } = {}
): RowResolution {
  const sameEcosystem = rows.filter(r => r.platform === platform)
  const exact = sameEcosystem.find(r => r.console === gameConsole)
  if (exact) return { action: 'update', row: exact }

  if (gameConsole === 'UNKNOWN') {
    if (sameEcosystem.length === 0) return { action: 'create' }
    return sameEcosystem.length === 1
      ? { action: 'update', row: sameEcosystem[0] }
      : { action: 'skip' }
  }

  const unknown = sameEcosystem.find(r => r.console === 'UNKNOWN')
  if (unknown) return { action: 'adopt', row: unknown }
  if (options.fromImport && sameEcosystem.length === 1) {
    return { action: 'update', row: sameEcosystem[0] }
  }
  return { action: 'create' }
}

function toDateString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null
}

function legacyValues(userGame: UserGameWithPlatforms): PlatformValues {
  const legacyHours = userGame.UserGameStats?.hoursPlayed
  const completions = userGame.UserGameStats?.completions ?? 0
  return {
    hoursPlayed: legacyHours != null ? Number(legacyHours) : null,
    completions,
    completedAt: completions > 0 ? userGame.completedAt : null
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
        console: p.console,
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

  private assertConsole(platform: Platform, gameConsole: Console) {
    if (!isConsoleAllowed(platform, gameConsole)) {
      throw new ClientError('Console inválido para esta plataforma.', 400)
    }
  }

  async addPlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    gameConsole: Console
  ) {
    this.assertConsole(platform, gameConsole)
    const userGame = await this.requireUserGame(igdbId, userId)

    if (userGame.userGamesStatusId === WISHLIST_STATUS_ID) {
      throw new ClientError(
        'Não é possível definir plataformas para um jogo da lista de desejos.',
        400
      )
    }

    const resolution = resolveRow(userGame.platforms, platform, gameConsole)

    if (
      resolution.action === 'skip' ||
      (resolution.action === 'update' && resolution.row.console !== gameConsole)
    ) {
      throw new ClientError(
        'Este jogo já tem consoles registrados nesta plataforma. Informe o console.',
        400
      )
    }

    if (resolution.action === 'adopt') {
      await this.platformRepository.adoptConsole(
        userGame.id,
        platform,
        resolution.row.console,
        gameConsole,
        {}
      )
    } else if (resolution.action === 'create') {
      const isPlayed = userGame.userGamesStatusId === PLAYED_STATUS_ID
      const inherited: PlatformValues =
        userGame.platforms.length === 0 ? legacyValues(userGame) : {}
      const values: PlatformValues = isPlayed
        ? {
            ...inherited,
            completions: Math.max(inherited.completions ?? 0, 1)
          }
        : inherited
      await this.platformRepository.savePlatform(
        userGame.id,
        platform,
        gameConsole,
        values
      )
    }

    return this.getPlatforms(userId, igdbId)
  }

  async updatePlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    gameConsole: Console,
    patch: PlatformPatch
  ) {
    this.assertConsole(platform, gameConsole)
    const userGame = await this.requireUserGame(igdbId, userId)

    if (
      !userGame.platforms.some(
        p => p.platform === platform && p.console === gameConsole
      )
    ) {
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

    await this.platformRepository.savePlatform(
      userGame.id,
      platform,
      gameConsole,
      values
    )

    return this.getPlatforms(userId, igdbId)
  }

  async removePlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    gameConsole: Console
  ) {
    this.assertConsole(platform, gameConsole)
    const userGame = await this.requireUserGame(igdbId, userId)

    if (
      !userGame.platforms.some(
        p => p.platform === platform && p.console === gameConsole
      )
    ) {
      throw new ClientError('Plataforma não encontrada neste jogo.', 404)
    }

    await this.platformRepository.deletePlatform(
      userGame.id,
      platform,
      gameConsole
    )

    return this.getPlatforms(userId, igdbId)
  }

  async importPlatform(
    userId: string,
    igdbId: number,
    platform: Platform,
    data: ImportedPlatformData,
    gameConsole: Console = 'UNKNOWN'
  ): Promise<'imported' | 'updated' | 'skipped'> {
    this.assertConsole(platform, gameConsole)
    let userGame = await this.platformRepository.findUserGameWithPlatforms(
      igdbId,
      userId
    )
    const existingResolution = userGame
      ? resolveRow(userGame.platforms, platform, gameConsole, {
          fromImport: true
        })
      : null
    if (existingResolution?.action === 'skip') return 'skipped'

    const isNew = !userGame
    const isUndecided =
      !!userGame &&
      (userGame.userGamesStatusId === WISHLIST_STATUS_ID ||
        userGame.userGamesStatusId === BACKLOG_STATUS_ID)
    const hasNoCompletion =
      !!userGame && userGame.platforms.every(p => (p.completions ?? 0) === 0)
    const isPromotableInProgress =
      !!userGame &&
      userGame.userGamesStatusId === PLAYING_STATUS_ID &&
      !!data.strongFinished &&
      hasNoCompletion
    const isEndless = isNew ? !!data.endless : !!userGame?.endless
    const trustsHeuristic = isNew || isUndecided || isPromotableInProgress
    const countsAsCompletion =
      !isEndless &&
      (trustsHeuristic ? data.finished : data.confirmedFinished)

    if (!userGame) {
      await this.userRepository.addGameToUserLibrary({
        igdbId,
        userId,
        statusIds: isEndless ? data.activityStatusId : data.statusId,
        completedAt: isEndless ? undefined : data.completedAt,
        endless: data.endless
      })
      await this.userRepository.createUserGameStats(userId, igdbId, 0)
      userGame = await this.requireUserGame(igdbId, userId)
    } else {
      const targetStatusId =
        !isEndless &&
        (data.confirmedFinished ||
          ((isUndecided || isPromotableInProgress) && data.finished))
          ? PLAYED_STATUS_ID
          : data.activityStatusId
      if (
        (STATUS_RANK[targetStatusId] ?? 0) >
        (STATUS_RANK[userGame.userGamesStatusId] ?? 0)
      ) {
        await this.userRepository.updateGameStatus(
          igdbId,
          userId,
          targetStatusId
        )
      }
    }

    const resolution: RowResolution = existingResolution ?? {
      action: 'create'
    }
    const existing =
      resolution.action === 'update' || resolution.action === 'adopt'
        ? resolution.row
        : undefined
    const base: PlatformValues = existing
      ? {
          completions: existing.completions,
          completedAt: existing.completedAt
        }
      : userGame.platforms.length === 0 && !isNew
        ? legacyValues(userGame)
        : { completions: 0, completedAt: null }

    const values: PlatformValues = {
      hoursPlayed: data.hoursPlayed,
      completions: countsAsCompletion
        ? Math.max(base.completions ?? 0, 1)
        : (base.completions ?? 0),
      completedAt:
        base.completedAt ??
        (countsAsCompletion ? (data.completedAt ?? new Date()) : null)
    }

    if (resolution.action === 'adopt') {
      await this.platformRepository.adoptConsole(
        userGame.id,
        platform,
        resolution.row.console,
        gameConsole,
        values
      )
    } else {
      await this.platformRepository.savePlatform(
        userGame.id,
        platform,
        resolution.action === 'update' ? resolution.row.console : gameConsole,
        values
      )
    }

    return isNew ? 'imported' : 'updated'
  }
}
