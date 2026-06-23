import { Status } from '@prisma/client'
import { UpdateUserDTO } from '../dtos/user.dto'
import { ClientError } from '../errors/client-error'
import { RatingRepository } from '../repositories/rating.repository'
import { UserRepository } from '../repositories/users.repository'
import { IGDBService } from './igdb.service'
import { randomInt } from 'crypto'

const PLAYED_STATUS_ID = 1

export class UserService {
  private readonly ITEMS_PER_PAGE = 30

  constructor(
    private userRepository: UserRepository,
    private ratingRepository: RatingRepository
  ) {}

  async addGameToUserLibrary(
    igdbId: number,
    userId: string,
    statusIds: number
  ) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

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
    const existingUser = await this.userRepository.findUserById(userId)

    if (!existingUser) throw new ClientError('User not found.', 404)

    return { user: await this.userRepository.deleteUser(userId) }
  }

  async findMe(userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found')

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
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

    const gamesAmount = await this.userRepository.countUserGames(userId)

    return {
      user: {
        id: user.id,
        email: user.email,
        profilePicture: user.profilePicture,
        userBanner: user.userBanner,
        userName: user.userName,
        gamesAmount: gamesAmount?._count.userGames
      }
    }
  }

  async findUserGameStatus(igdbId: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

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
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

    const userGames = await this.userRepository.findManyGamesOfUser(
      userId,
      filter
    )

    if (userGames.length === 0) {
      const totalPerStatus =
        await this.userRepository.findGamesCountByStatus(userId)
      return {
        games: {
          PLAYED: [],
          PLAYING: [],
          PAUSED: [],
          BACKLOG: [],
          WISHLIST: []
        },
        totalPerStatus: totalPerStatus.map(item => ({
          status: item.status,
          totalGames: item._count.userGames
        }))
      }
    }

    const igdbIds = userGames.map(ug => ug.igdbId)
    const [igdbGames, ratingsMap] = await Promise.all([
      IGDBService.getGamesByIds(igdbIds),
      this.ratingRepository.getAverageRatingsForGames(igdbIds)
    ])

    const igdbMap = new Map(igdbGames.map(g => [g.id, g]))

    let enriched = userGames
      .map(ug => {
        const g = igdbMap.get(ug.igdbId)
        if (!g) return null
        return {
          igdbId: g.id,
          name: g.name,
          coverUrl: IGDBService.formatCoverUrl(g.cover?.url),
          platforms: g.platforms?.map(p => p.name),
          releaseDate: g.first_release_date,
          siteRating: ratingsMap.get(ug.igdbId) ?? null,
          status: ug.UserGamesStatus.status as string
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)

    if (query) {
      const q = query.toLowerCase()
      enriched = enriched.filter(g => g.name.toLowerCase().includes(q))
    }

    const sortMultiplier = sortOrder === 'asc' ? 1 : -1
    enriched.sort((a, b) => {
      if (sortBy === 'gameName')
        return sortMultiplier * a.name.localeCompare(b.name)
      if (sortBy === 'dateRelease')
        return sortMultiplier * ((a.releaseDate ?? 0) - (b.releaseDate ?? 0))
      if (sortBy === 'rating')
        return sortMultiplier * ((a.siteRating ?? -1) - (b.siteRating ?? -1))
      return 0
    })

    const paged = enriched.slice(
      pageIndex * this.ITEMS_PER_PAGE,
      (pageIndex + 1) * this.ITEMS_PER_PAGE
    )

    const games: Record<string, typeof paged> = {
      PLAYED: [],
      PLAYING: [],
      PAUSED: [],
      BACKLOG: [],
      WISHLIST: []
    }

    for (const entry of paged) {
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

  async removeGame(igdbId: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

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

    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

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
    const userAlreadyExist = await this.userRepository.findUserById(userId)

    if (!userAlreadyExist) throw new ClientError('User not found.', 404)

    const user = await this.userRepository.updateUser(userId, {
      profilePicture: data.profilePicture,
      userBanner: data.userBanner,
      userName: data.userName
    })

    return { user }
  }

  async findUserGameStats(igdbId: number, userId: string) {
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

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
    const user = await this.userRepository.findUserById(userId)

    if (!user) throw new ClientError('User not found.', 404)

    const userGameStats = await this.userRepository.updateUserGamePlayedCount(
      userId,
      igdbId,
      incrementValue
    )

    return { playedCount: userGameStats.completions }
  }

  async findGamesToDisplay(userId: string) {
    const user = await this.userRepository.findUserById(userId)
    if (!user) throw new ClientError('User not found.', 404)

    const userGames = await this.userRepository.findManyGamesOfUser(userId)

    const playingIds = userGames
      .filter(ug => ug.UserGamesStatus.status === Status.PLAYING)
      .map(ug => ug.igdbId)

    const backlogIds = userGames
      .filter(ug => ug.UserGamesStatus.status === Status.BACKLOG)
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

    const { trending } = await IGDBService.getFeaturedGames()
    const notOwned = trending.filter(g => !ownedIds.has(g.id))

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
