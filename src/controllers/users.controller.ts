import { FastifyReply, FastifyRequest } from 'fastify'
import { UserService } from '../services/users.service'
import * as UserSchema from '../schemas/user.schema'
import { ClientError } from '../errors/client-error'

export class UserController {
  constructor(private userService: UserService) {}

  async addGameToUserLibrary(request: FastifyRequest, reply: FastifyReply) {
    const { userId, gameId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { statusIds } = UserSchema.UserGameBodySchema.parse(request.body)

    const { game } = await this.userService.addGameToUserLibrary(
      gameId,
      userId,
      statusIds
    )

    return reply.send({ game })
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.delete(userId)

    return reply.send({ user })
  }

  async getAllUserGames(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query, filter } = UserSchema.QueryStringSchema.parse(
      request.query
    )

    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { totalPerStatus, totalGames, userGames } =
      await this.userService.findManyUserGames(userId, pageIndex, filter, query)

    return reply.send({ userGames, totalPerStatus, totalGames })
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    if (!userId) {
      throw new ClientError('User ID not found in token')
    }

    const { user } = await this.userService.findMe(userId)

    return reply.send({ user })
  }

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.findById(userId)

    return reply.send({ user })
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query } = UserSchema.QueryStringSchema.parse(
      request.query
    )

    const { users } = await this.userService.findManyUsers(pageIndex, query)

    return reply.send({ users })
  }

  async getUserGameStatus(request: FastifyRequest, reply: FastifyReply) {
    const { gameId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { userGameStatuses } = await this.userService.findUserGameStatus(
      gameId,
      userId
    )

    return reply.send({ userGameStatuses })
  }

  async removeGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { game } = await this.userService.removeGame(gameId, userId)

    return reply.send({ game })
  }

  async updateGame(request: FastifyRequest, reply: FastifyReply) {
    const { userId, gameId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { statusIds } = UserSchema.UserGameBodySchema.parse(request.body)

    const { game, statuses } = await this.userService.updateGame(
      gameId,
      userId,
      statusIds
    )

    return reply.send({ game, statuses })
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { profilePicture, userBanner, userName } =
      UserSchema.UpdateUserBodySchema.parse(request.body)

    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.update(userId, {
      profilePicture,
      userBanner,
      userName
    })

    return reply.send({ user })
  }

  async getUserGameStats(request: FastifyRequest, reply: FastifyReply) {
    const { userId, gameId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { userGameStats } = await this.userService.findUserGameStats(
      gameId,
      userId
    )

    return reply.send({ userGameStats })
  }

  async updateUserGamePlayedCount(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { gameId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { incrementValue } =
      UserSchema.UserGamePlayedCountUpdateBodySchema.parse(request.body)

    const { userGameStats } = await this.userService.updateUserGamePlayedCount(
      userId,
      gameId,
      incrementValue
    )

    return reply.send({ userGameStats })
  }
}
