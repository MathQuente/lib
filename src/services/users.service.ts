import { Status } from '@prisma/client'
import { UpdateUserDTO } from '../dtos/user.dto'
import { ClientError } from '../errors/client-error'
import { RatingRepository } from '../repositories/rating.repository'
import {
  PaginatedUserGameRow,
  UserRepository
} from '../repositories/users.repository'
import { IGDBService } from './igdb.service'
import { GameCacheService } from './game-cache.service'
import { randomInt } from 'crypto'

const PLAYED_STATUS_ID = 1

export class UserService {
  private readonly ITEMS_PER_PAGE = 30

  constructor(
    private userRepository: UserRepository,
    private ratingRepository: RatingRepository,
    private gameCacheService: GameCacheService
  ) {}

  private async requireUser(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('User not found.', 404)
    return user
  }

  async addGameToUserLibrary(
    igdbId: number,
    userId: string,
    statusIds: number
  ) {
    await this.requireUser(userId)

    const gameExists = await this.gameCacheService.ensureCached(igdbId)
    if (!gameExists) throw new ClientError('Game not found.', 404)

    const existing = await this.userRepository.findUserGame(igdbId, userId)

    if (existing)
      throw new ClientError('This game is already in your library', 409)

    const { igdbId: addedId } = await this.userRepository.addGameToUserLibrary({
      igdbId,
      statusIds,
      userId
    })

    await this.userRepository.createUserGameStats(userId, igdbId)

    return { igdbId: addedId }
  }

  async delete(userId: string) {
    await this.requireUser(userId)

    return { user: await this.userRepository.deleteUser(userId) }
  }

  async findMe(userId: string) {
    const user = await this.requireUser(userId)

    return {
      user: {
        id: user.id,
        profilePicture: user.profilePicture,
        userName: user.userName,
        userBanner: user.userBanner,
        gamesAmount: user._count.userGames
      }
    }
  }

  async findById(userId: string) {
    const user = await this.requireUser(userId)

    const gamesAmount = await this.userRepository.countUserGames(userId)

    return {
      user: {
        id: user.id,
        profilePicture: user.profilePicture,
        userBanner: user.userBanner,
        userName: user.userName,
        gamesAmount: gamesAmount?._count.userGames
      }
    }
  }

  async findUserGameStatus(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const userGameStatus = await this.userRepository.findUserGameStatus(
      igdbId,
      userId
    )

    return { userGameStatus: userGameStatus?.UserGamesStatus || null }
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
    sortBy: 'gameName' | 'dateRelease' | 'rating',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    await this.requireUser(userId)

    const rows = await this.userRepository.findManyGamesOfUser({
      userId,
      filter,
      query,
      sortBy,
      sortOrder,
      skip: pageIndex * this.ITEMS_PER_PAGE,
      take: this.ITEMS_PER_PAGE
    })

    const enriched = await this.fillMissingGameCacheEntries(rows)

    const games: Record<string, typeof enriched> = {
      PLAYED: [],
      PLAYING: [],
      PAUSED: [],
      BACKLOG: [],
      WISHLIST: []
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

  // Safety net for igdbIds that reached user_games without ever landing in
  // games_cache (pre-existing gap, or the fire-and-forget cache write from
  // addGameToUserLibrary/createRating hasn't completed yet). Should be
  // unreachable in steady state after the backfill script has run.
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
            siteRating: r.siteRating,
            status: r.status as string
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
          siteRating: r.siteRating,
          status: r.status as string
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
  }

  async removeGame(igdbId: number, userId: string) {
    await this.requireUser(userId)

    const existing = await this.userRepository.findUserGame(igdbId, userId)

    if (!existing)
      throw new ClientError('This game is not in your library', 409)

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
    if (!statusId) throw new ClientError('You need to pass your status', 400)

    await this.requireUser(userId)

    const userGame = await this.userRepository.findUserGame(igdbId, userId)

    if (!userGame) throw new ClientError('Game not found in your library.', 404)

    const currentStatus = userGame.UserGamesStatus.id

    if (currentStatus === PLAYED_STATUS_ID && statusId !== PLAYED_STATUS_ID) {
      await this.userRepository.removeUserGameStats(userId, igdbId)

      const { igdbId: updatedId, UserGamesStatus } =
        await this.userRepository.updateGameStatus(igdbId, userId, statusId)

      return {
        igdbId: updatedId,
        userGameStatus: UserGamesStatus,
        playedCountUpdated: 0
      }
    }

    if (currentStatus !== PLAYED_STATUS_ID && statusId === PLAYED_STATUS_ID) {
      const stats = await this.userRepository.createUserGameStats(
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

    return {
      igdbId: updatedId,
      userGameStatus: UserGamesStatus,
      playedCountUpdated: 0
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

    const userGameStats = await this.userRepository.updateUserGamePlayedCount(
      userId,
      igdbId,
      incrementValue
    )

    return { playedCount: userGameStats?.completions ?? 0 }
  }

  async findGamesToDisplay(userId: string) {
    await this.requireUser(userId)

    const userGames = await this.userRepository.findManyGamesOfUser({ userId })

    const playingIds = userGames
      .filter(ug => ug.status === Status.PLAYING)
      .map(ug => ug.igdbId)

    const backlogIds = userGames
      .filter(ug => ug.status === Status.BACKLOG)
      .map(ug => ug.igdbId)

    const ownedIds = new Set(userGames.map(ug => ug.igdbId))

    if (playingIds.length > 0) {
      const pickedId = playingIds[randomInt(playingIds.length)]
      const game = await IGDBService.getGameById(pickedId)
      return {
        game: game
          ? {
              igdbId: game.id,
              name: game.name,
              coverUrl: IGDBService.formatCoverUrl(game.cover?.url)
            }
          : null,
        message: 'Por que não terminar o que já começou?'
      }
    }

    if (backlogIds.length > 0) {
      const pickedId = backlogIds[randomInt(backlogIds.length)]
      const game = await IGDBService.getGameById(pickedId)
      return {
        game: game
          ? {
              igdbId: game.id,
              name: game.name,
              coverUrl: IGDBService.formatCoverUrl(game.cover?.url)
            }
          : null,
        message: 'Tire a poeira desses jogos esquecidos.'
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
