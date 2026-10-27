import { Status } from '@prisma/client'
import { UpdateUserDTO } from '../dtos/user.dto'
import { ClientError } from '../errors/client-error'
import { isRecordNotFound, isUniqueViolation } from '../utils/prisma-errors'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { FollowRepository } from '../repositories/follow.repository'
import { PaginatedUserGameRow } from '../types/user'
import { IGDBService } from './igdb.service'
import { SteamApiService } from './steam-api.service'
import { GameCacheService } from './game-cache.service'
import { UserGamePlatformRepository } from '../repositories/user-game-platform.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { markSessionsRevoked } from '../utils/session-revocation'
import { randomInt } from 'crypto'

const PLAYED_STATUS_ID = 1
const WISHLIST_STATUS_ID = 5
const STEAM_PERSONA_TTL_SECONDS = 6 * 60 * 60
const STEAM_PERSONA_FAILURE_TTL_SECONDS = 60
const steamPersonaKey = (steamId: string) => `steam:persona:${steamId}`
const EDIT_BY_PLATFORM_MESSAGE =
  'Este jogo tem plataformas cadastradas. Edite os valores por plataforma.'

export class UserService {
  private readonly ITEMS_PER_PAGE = 30
  private readonly USER_GAMES_PER_PAGE = 40

  constructor(
    private userRepository: UserRepository,
    private ratingRepository: RatingRepository,
    private gameCacheService: GameCacheService,
    private followRepository: FollowRepository,
    private platformRepository: UserGamePlatformRepository = new UserGamePlatformRepository(),
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    return user
  }

  async addGameToUserLibrary(
    igdbId: number,
    userId: string,
    statusIds: number
  ) {
    await this.requireUser(userId)

    const gameExists = await this.gameCacheService.ensureCached(igdbId)
    if (!gameExists) throw new ClientError('Jogo não encontrado.', 404)

    const existing = await this.userRepository.findUserGame(igdbId, userId)

    if (existing)
      throw new ClientError('Este jogo já está na sua biblioteca.', 409)

    const endless = await this.gameCacheService.suggestsEndless(igdbId)

    let addedId: number
    try {
      ;({ igdbId: addedId } = await this.userRepository.addGameToUserLibrary({
        igdbId,
        statusIds,
        userId,
        endless
      }))
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ClientError('Este jogo já está na sua biblioteca.', 409)
      }
      throw err
    }

    await this.userRepository.createUserGameStats(
      userId,
      igdbId,
      statusIds === PLAYED_STATUS_ID ? 1 : 0
    )

    return { igdbId: addedId }
  }

  async delete(userId: string) {
    await this.requireUser(userId)

    const user = await this.userRepository.deleteUser(userId)

    try {
      await markSessionsRevoked(this.cacheRepository, userId)
    } catch (error) {
      console.error('Session revocation after account deletion failed:', {
        error: error instanceof Error ? error.message : 'unknown error'
      })
    }

    return { user }
  }

  private async getSteamPersonaName(
    steamId: string | null
  ): Promise<string | null> {
    if (!steamId) return null

    try {
      const key = steamPersonaKey(steamId)
      const cached = await this.cacheRepository.get(key)
      if (cached && typeof cached === 'object' && 'name' in cached) {
        return (cached as { name: string | null }).name
      }

      let name: string | null = null
      try {
        name = await SteamApiService.getPersonaName(steamId)
      } catch (error) {
        console.error('Steam persona lookup failed:', {
          error: error instanceof Error ? error.message : 'unknown error'
        })
      }

      await this.cacheRepository.set(
        key,
        { name },
        name ? STEAM_PERSONA_TTL_SECONDS : STEAM_PERSONA_FAILURE_TTL_SECONDS
      )
      return name
    } catch {
      return null
    }
  }

  async findMe(userId: string) {
    const user = await this.requireUser(userId)

    const totalHoursPlayed =
      await this.userRepository.sumUserHoursPlayed(userId)
    const followersCount = await this.followRepository.countFollowers(userId)
    const followingCount = await this.followRepository.countFollowing(userId)

    return {
      user: {
        id: user.id,
        profilePicture: user.profilePicture,
        userName: user.userName,
        userBanner: user.userBanner,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        gamesAmount: user._count.userGames,
        totalHoursPlayed: totalHoursPlayed ? Number(totalHoursPlayed) : 0,
        steamId: user.steamId,
        steamPersonaName: await this.getSteamPersonaName(user.steamId),
        psnOnlineId: user.psnOnlineId,
        xboxGamertag: user.xboxGamertag,
        followersCount,
        followingCount
      }
    }
  }

  async findById(userId: string) {
    const user = await this.requireUser(userId)

    const gamesAmount = await this.userRepository.countUserGames(userId)
    const totalHoursPlayed =
      await this.userRepository.sumUserHoursPlayed(userId)
    const followersCount = await this.followRepository.countFollowers(userId)
    const followingCount = await this.followRepository.countFollowing(userId)

    return {
      user: {
        id: user.id,
        profilePicture: user.profilePicture,
        userBanner: user.userBanner,
        userName: user.userName,
        gamesAmount: gamesAmount?._count.userGames,
        totalHoursPlayed: totalHoursPlayed ? Number(totalHoursPlayed) : 0,
        followersCount,
        followingCount
      }
    }
  }

  async findUserGameStatus(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const userGameStatus = await this.userRepository.findUserGameStatus(
      igdbId,
      userId
    )

    return {
      userGameStatus: userGameStatus?.UserGamesStatus || null,
      endless: userGameStatus?.endless ?? false,
      hoursPlayed: Number(userGameStatus?.UserGameStats?.hoursPlayed ?? 0),
      completions: userGameStatus?.UserGameStats?.completions ?? 0
    }
  }

  async setEndless(igdbId: number, userId: string, endless: boolean) {
    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGame(igdbId, userId)
    if (!userGame)
      throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)

    try {
      return await this.userRepository.setEndless(igdbId, userId, endless)
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)
      }
      throw error
    }
  }

  async findManyUsers(pageIndex: number, query: string | undefined) {
    const users = await this.userRepository.findManyUsers({
      pageIndex,
      limit: this.ITEMS_PER_PAGE,
      query
    })

    return {
      users: users.map(user => ({
        id: user.id,
        userBanner: user.userBanner,
        userName: user.userName,
        profilePicture: user.profilePicture,
        userGamesAmount: user._count.userGames
      }))
    }
  }

  async findManyUserGames(
    userId: string,
    pageIndex: number,
    filter: Status | undefined,
    query: string | undefined,
    sortBy:
      | 'gameName'
      | 'dateRelease'
      | 'rating'
      | 'dateAdded'
      | 'hoursPlayed'
      | 'completedAt' = 'dateAdded',
    sortOrder: 'asc' | 'desc' = sortBy === 'dateAdded' || sortBy === 'completedAt'
      ? 'desc'
      : 'asc'
  ) {
    await this.requireUser(userId)

    const rows = await this.userRepository.findManyGamesOfUser({
      userId,
      filter,
      query,
      sortBy,
      sortOrder,
      skip: filter ? pageIndex * this.USER_GAMES_PER_PAGE : undefined,
      take: filter ? this.USER_GAMES_PER_PAGE : undefined
    })

    const enriched = await this.fillMissingGameCacheEntries(rows)

    const games: Record<string, typeof enriched> = {
      PLAYED: [],
      PLAYING: [],
      PAUSED: [],
      BACKLOG: [],
      WISHLIST: [],
      DROPPED: []
    }

    for (const entry of enriched) {
      if (entry.status in games) {
        games[entry.status].push(entry)
      }
    }

    const totalPerStatus =
      await this.userRepository.findGamesCountByStatus(userId)

    const totalPerStatusMapped = totalPerStatus.map(item => ({
      status: item.status,
      totalGames: item._count.userGames
    }))

    const total = filter
      ? (totalPerStatusMapped.find(t => t.status === filter)?.totalGames ?? 0)
      : totalPerStatusMapped.reduce((acc, t) => acc + t.totalGames, 0)

    return { games, totalPerStatus: totalPerStatusMapped, total }
  }

  private readonly PUBLIC_PROFILE_PREVIEW_PER_STATUS = 6

  async findPublicUserGames(userId: string) {
    await this.requireUser(userId)

    const result = await this.findManyUserGames(
      userId,
      0,
      undefined,
      undefined,
      'completedAt',
      'desc'
    )

    const games = Object.fromEntries(
      Object.entries(result.games).map(([status, list]) => [
        status,
        list.slice(0, this.PUBLIC_PROFILE_PREVIEW_PER_STATUS)
      ])
    ) as typeof result.games

    return { ...result, games }
  }

  async findUserFollowers(userId: string) {
    await this.requireUser(userId)
    const followers = await this.followRepository.findFollowers(userId)
    return { followers }
  }

  async findUserFollowing(userId: string) {
    await this.requireUser(userId)
    const following = await this.followRepository.findFollowing(userId)
    return { following }
  }

  private async fillMissingGameCacheEntries(rows: PaginatedUserGameRow[]) {
    const missing = rows.filter(r => r.name === null)

    const fetched =
      missing.length > 0
        ? await IGDBService.getGamesByIds(missing.map(r => r.igdbId))
        : []
    const fetchedMap = new Map(fetched.map(g => [g.id, g]))

    if (fetched.length > 0) {
      this.gameCacheService
        .cacheMany(fetched)
        .catch(err => console.error('[GameCache] cacheMany failed', err))
    }

    return rows
      .map(r => {
        if (r.name !== null) {
          return {
            igdbId: r.igdbId,
            name: r.name,
            coverUrl: r.coverUrl,
            platforms: r.platforms ?? undefined,
            releaseDate: r.releaseDate ?? undefined,
            rating: r.rating,
            completions: r.completions,
            hoursPlayed: r.hoursPlayed,
            playedOn: r.playedOn ?? [],
            status: r.status as string,
            endless: r.endless
          }
        }

        const g = fetchedMap.get(r.igdbId)
        if (!g) return null

        return {
          igdbId: r.igdbId,
          name: g.name,
          coverUrl: IGDBService.formatCoverUrl(g.cover?.url),
          platforms: g.platforms?.map(p => p.name),
          releaseDate: g.first_release_date,
          rating: r.rating,
          completions: r.completions,
          hoursPlayed: r.hoursPlayed,
          playedOn: r.playedOn ?? [],
          status: r.status as string,
          endless: r.endless
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }

  async removeGame(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const existing = await this.userRepository.findUserGame(igdbId, userId)

    if (!existing)
      throw new ClientError('Este jogo não está na sua biblioteca.', 409)

    const { igdbId: removedId } = await this.userRepository.removeGame(
      igdbId,
      userId
    )

    const rating = await this.ratingRepository.findUniqueByUserGame(
      igdbId,
      userId
    )
    if (rating) await this.ratingRepository.delete(igdbId, userId)

    return { igdbId: removedId }
  }

  async updateGame(igdbId: number, userId: string, statusId: number) {
    if (!statusId) throw new ClientError('Você precisa informar o status.', 400)

    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGame(igdbId, userId)

    if (!userGame) throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)

    const currentStatus = userGame.UserGamesStatus.id
    const hasPlatforms = (userGame._count?.platforms ?? 0) > 0

    if (statusId === WISHLIST_STATUS_ID) {
      const rating = await this.ratingRepository.findUniqueByUserGame(
        igdbId,
        userId
      )
      if (rating) await this.ratingRepository.delete(igdbId, userId)
    }

    if (hasPlatforms && statusId !== currentStatus) {
      const { igdbId: updatedId, UserGamesStatus } =
        await this.userRepository.updateGameStatus(igdbId, userId, statusId)

      if (statusId === PLAYED_STATUS_ID) {
        await this.platformRepository.markSinglePlatformCompleted(
          userGame.id,
          new Date()
        )
      }

      const { stats } = await this.userRepository.findUserGameStats(
        igdbId,
        userId
      )

      return {
        igdbId: updatedId,
        userGameStatus: UserGamesStatus,
        playedCountUpdated: stats?.completions ?? 0
      }
    }

    if (currentStatus !== PLAYED_STATUS_ID && statusId === PLAYED_STATUS_ID) {
      const stats = await this.userRepository.ensureAtLeastOneCompletion(
        userId,
        igdbId
      )

      const { igdbId: updatedId, UserGamesStatus } =
        await this.userRepository.updateGameStatus(igdbId, userId, statusId)

      return {
        igdbId: updatedId,
        userGameStatus: UserGamesStatus,
        playedCountUpdated: stats?.completions ?? 0
      }
    }

    const { igdbId: updatedId, UserGamesStatus } =
      await this.userRepository.updateGameStatus(igdbId, userId, statusId)
    const { stats } = await this.userRepository.findUserGameStats(
      igdbId,
      userId
    )

    return {
      igdbId: updatedId,
      userGameStatus: UserGamesStatus,
      playedCountUpdated: stats?.completions ?? 0
    }
  }

  async update(userId: string, data: UpdateUserDTO) {
    await this.requireUser(userId)

    const user = await this.userRepository.updateUser(userId, {
      profilePicture: data.profilePicture,
      userBanner: data.userBanner,
      userName: data.userName
    })

    return { user }
  }

  async findUserGameStats(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const { stats } = await this.userRepository.findUserGameStats(
      igdbId,
      userId
    )

    return { playedCount: stats?.completions || 0 }
  }

  async updateUserGamePlayedCount(
    userId: string,
    igdbId: number,
    incrementValue: number
  ) {
    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGame(igdbId, userId)
    if ((userGame?._count?.platforms ?? 0) > 0) {
      throw new ClientError(EDIT_BY_PLATFORM_MESSAGE, 400)
    }

    const { stats } = await this.userRepository.findUserGameStats(igdbId, userId)
    const minimum = userGame?.UserGamesStatus?.id === PLAYED_STATUS_ID ? 1 : 0
    if ((stats?.completions ?? 0) + incrementValue < minimum) {
      throw new ClientError(
        minimum === 1
          ? 'Um jogo marcado como Jogado precisa de pelo menos uma conclusão.'
          : 'O número de vezes zerado não pode ser negativo.',
        400
      )
    }

    const userGameStats = await this.userRepository.updateUserGamePlayedCount(
      userId,
      igdbId,
      incrementValue
    )

    return { playedCount: userGameStats?.completions ?? 0 }
  }

  async findUserGameHours(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const { stats } = await this.userRepository.findUserGameHours(
      igdbId,
      userId
    )

    return { hoursPlayed: stats?.hoursPlayed ? Number(stats.hoursPlayed) : 0 }
  }

  async findUserGameCompletedAt(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGameForCompletedAt(
      igdbId,
      userId
    )
    if (!userGame) throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)

    return {
      completedAt: userGame.completedAt
        ? userGame.completedAt.toISOString().slice(0, 10)
        : null
    }
  }

  async updateUserGameCompletedAt(
    userId: string,
    igdbId: number,
    completedAt: string
  ) {
    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGameForCompletedAt(
      igdbId,
      userId
    )
    if (!userGame) throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)

    if ((userGame._count?.platforms ?? 0) > 0) {
      throw new ClientError(EDIT_BY_PLATFORM_MESSAGE, 400)
    }

    if (userGame.userGamesStatusId !== PLAYED_STATUS_ID) {
      throw new ClientError(
        'Só é possível definir a data de finalização para jogos marcados como Jogado.',
        400
      )
    }

    const parsedDate = new Date(`${completedAt}T00:00:00.000Z`)
    if (parsedDate.getTime() > Date.now()) {
      throw new ClientError(
        'A data de finalização não pode ser no futuro.',
        400
      )
    }

    const updated = await this.userRepository.updateUserGameCompletedAt(
      igdbId,
      userId,
      parsedDate
    )

    return { completedAt: updated.completedAt!.toISOString().slice(0, 10) }
  }

  async updateUserGameHours(
    userId: string,
    igdbId: number,
    hoursPlayed: number
  ) {
    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGameStatus(
      igdbId,
      userId
    )
    if (!userGame) throw new ClientError('Jogo não encontrado na sua biblioteca.', 404)

    if ((userGame._count?.platforms ?? 0) > 0) {
      throw new ClientError(EDIT_BY_PLATFORM_MESSAGE, 400)
    }

    if (userGame.UserGamesStatus?.status === Status.WISHLIST) {
      throw new ClientError('Não é possível definir horas jogadas para um jogo da lista de desejos.', 400)
    }

    const stats = await this.userRepository.upsertUserGameHours(
      userId,
      igdbId,
      hoursPlayed
    )

    return { hoursPlayed: stats?.hoursPlayed ? Number(stats.hoursPlayed) : 0 }
  }

  async findGamesToDisplay(userId: string) {
    await this.requireUser(userId)

    const userGames = await this.userRepository.findManyGamesOfUser({ userId })

    const idsWithStatus = (status: Status) =>
      userGames.filter(ug => ug.status === status).map(ug => ug.igdbId)

    const pausedIds = idsWithStatus(Status.PAUSED)
    const backlogIds = idsWithStatus(Status.BACKLOG)
    const candidateIds = pausedIds.length > 0 ? pausedIds : backlogIds

    const ownedIds = new Set(userGames.map(ug => ug.igdbId))

    if (candidateIds.length > 0) {
      const pickedId = candidateIds[randomInt(candidateIds.length)]
      const game = await IGDBService.getGameById(pickedId)
      return {
        game: game
          ? {
              igdbId: game.id,
              name: game.name,
              coverUrl: IGDBService.formatCoverUrl(game.cover?.url)
            }
          : null,
        message:
          pausedIds.length > 0
            ? 'Que tal retomar este?'
            : 'Tire a poeira desses jogos esquecidos.'
      }
    }

    const recent = await IGDBService.getRecentlyReleasedGames()
    const notOwned = recent.filter(g => !ownedIds.has(g.id))

    if (notOwned.length > 0) {
      const picked = notOwned[randomInt(notOwned.length)]
      return {
        game: {
          igdbId: picked.id,
          name: picked.name,
          coverUrl: IGDBService.formatCoverUrl(picked.cover?.url)
        },
        message: 'Que tal adicionar um novo jogo a sua biblioteca?'
      }
    }

    return { game: null, message: 'Parabéns! Você jogou todos.' }
  }
}
