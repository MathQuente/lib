import { FastifyReply, FastifyRequest } from 'fastify'
import { UserService } from '../services/users.service'
import * as UserSchema from '../schemas/user.schema'
import { ClientError } from '../errors/client-error'
import { CacheRepository } from '../repositories/cache.repository'

const IDEMPOTENCY_TTL_SECONDS = 60
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
const IDEMPOTENCY_PENDING = 'pending'

export class UserController {
  constructor(
    private userService: UserService,
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  async addGameToUserLibrary(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { statusId } = UserSchema.UserGameBodySchema.parse(request.body)

    const { igdbId: addedId } = await this.userService.addGameToUserLibrary(
      igdbId,
      userId,
      statusId
    )

    return reply.status(201).send({ igdbId: addedId })
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId
    const { user } = await this.userService.delete(userId)
    return reply.status(200).send({ user })
  }

  async getAllUserGames(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query, filter, sortBy, sortOrder } =
      UserSchema.QueryStringSchema.parse(request.query)
    const userId = request.user.userId

    const { totalPerStatus, games, total } =
      await this.userService.findManyUserGames(
        userId,
        pageIndex,
        filter,
        query,
        sortBy,
        sortOrder
      )

    return reply.status(200).send({ games, totalPerStatus, total })
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    if (!userId) throw new ClientError('ID do usuário não encontrado no token.')

    const { user } = await this.userService.findMe(userId)

    return reply.send({ user })
  }

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)
    const { user } = await this.userService.findById(userId)
    return reply.status(200).send({ user })
  }

  async getPublicUserGames(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { totalPerStatus, games, total } =
      await this.userService.findPublicUserGames(userId)

    return reply.status(200).send({ totalPerStatus, games, total })
  }

  async getUserFollowers(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { followers } = await this.userService.findUserFollowers(userId)

    return reply.status(200).send({ followers })
  }

  async getUserFollowing(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { following } = await this.userService.findUserFollowing(userId)

    return reply.status(200).send({ following })
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query } = UserSchema.QueryStringSchema.parse(
      request.query
    )
    const { users } = await this.userService.findManyUsers(pageIndex, query)
    return reply.status(200).send({ users })
  }

  async getUserGameStatus(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId

    const { userGameStatus } = await this.userService.findUserGameStatus(
      igdbId,
      userId
    )

    return reply.status(200).send({ userGameStatus })
  }

  async removeGame(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { igdbId: removedId } = await this.userService.removeGame(
      igdbId,
      userId
    )
    return reply.status(200).send({ igdbId: removedId })
  }

  async updateGame(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { statusId } = UserSchema.UserGameBodySchema.parse(request.body)

    const {
      igdbId: updatedId,
      userGameStatus,
      playedCountUpdated
    } = await this.userService.updateGame(igdbId, userId, statusId)

    return reply
      .status(200)
      .send({ igdbId: updatedId, userGameStatus, playedCountUpdated })
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { profilePicture, userBanner, userName } =
      UserSchema.UpdateUserBodySchema.parse(request.body)
    const userId = request.user.userId

    const { user } = await this.userService.update(userId, {
      profilePicture,
      userBanner,
      userName
    })

    return reply.status(200).send({ user })
  }

  async getUserGameStats(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId

    const { playedCount } = await this.userService.findUserGameStats(
      igdbId,
      userId
    )

    return reply.status(200).send({ playedCount })
  }

  async updateUserGamePlayedCount(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { incrementValue } =
      UserSchema.UserGamePlayedCountUpdateBodySchema.parse(request.body)

    const header = request.headers['idempotency-key']
    const idempotencyKey =
      typeof header === 'string' && IDEMPOTENCY_KEY_PATTERN.test(header)
        ? `idempotency:${userId}:played-count:${igdbId}:${header}`
        : null

    if (idempotencyKey) {
      const acquired = await this.cacheRepository.setIfAbsent(
        idempotencyKey,
        IDEMPOTENCY_PENDING,
        IDEMPOTENCY_TTL_SECONDS
      )
      if (!acquired) {
        const previous = await this.cacheRepository.get(idempotencyKey)
        if (previous === IDEMPOTENCY_PENDING || previous === null) {
          throw new ClientError('Esta alteração já está sendo processada.', 409)
        }
        return reply.status(200).send(previous)
      }
    }

    let playedCount: number
    try {
      ;({ playedCount } = await this.userService.updateUserGamePlayedCount(
        userId,
        igdbId,
        incrementValue
      ))
    } catch (err) {
      if (idempotencyKey) await this.cacheRepository.del(idempotencyKey)
      throw err
    }

    if (idempotencyKey) {
      await this.cacheRepository.set(
        idempotencyKey,
        { playedCount },
        IDEMPOTENCY_TTL_SECONDS
      )
    }

    return reply.status(200).send({ playedCount })
  }

  async getUserGameHours(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId

    const { hoursPlayed } = await this.userService.findUserGameHours(
      igdbId,
      userId
    )

    return reply.status(200).send({ hoursPlayed })
  }

  async updateUserGameHours(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { hoursPlayed } = UserSchema.UserGameHoursUpdateBodySchema.parse(
      request.body
    )

    const { hoursPlayed: updated } = await this.userService.updateUserGameHours(
      userId,
      igdbId,
      hoursPlayed
    )

    return reply.status(200).send({ hoursPlayed: updated })
  }

  async getUserGameCompletedAt(request: FastifyRequest, reply: FastifyReply) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId

    const { completedAt } = await this.userService.findUserGameCompletedAt(
      igdbId,
      userId
    )

    return reply.status(200).send({ completedAt })
  }

  async updateUserGameCompletedAt(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { igdbId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { completedAt } = UserSchema.UserGameCompletedAtUpdateBodySchema.parse(
      request.body
    )

    const { completedAt: updated } =
      await this.userService.updateUserGameCompletedAt(
        userId,
        igdbId,
        completedAt
      )

    return reply.status(200).send({ completedAt: updated })
  }

  async getGamesToDisplay(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId
    const { game, message } = await this.userService.findGamesToDisplay(userId)
    return reply.status(200).send({ game, message })
  }
}
