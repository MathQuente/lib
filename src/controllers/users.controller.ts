import { FastifyReply, FastifyRequest } from 'fastify'
import { UserService } from '../services/users.service'
import * as UserSchema from '../schemas/user.schema'
import { ClientError } from '../errors/client-error'

export class UserController {
  constructor(private userService: UserService) {}

  async addGameToUserLibrary(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { statusId } = UserSchema.UserGameBodySchema.parse(request.body)

    const { game } = await this.userService.addGameToUserLibrary(
      gameId,
      userId,
      statusId
    )

    return reply.status(201).send({ game })
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const { user } = await this.userService.delete(userId)

    return reply.status(200).send({ user })
  }

  async getAllUserGames(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query, filter } = UserSchema.QueryStringSchema.parse(
      request.query
    )

    const userId = request.user.userId

    const { totalPerStatus, userGames } =
      await this.userService.findManyUserGames(userId, pageIndex, filter, query)

    return reply.status(200).send({ userGames, totalPerStatus })
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

    return reply.status(200).send({ user })
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query } = UserSchema.QueryStringSchema.parse(
      request.query
    )

    const { users } = await this.userService.findManyUsers(pageIndex, query)

    return reply.status(200).send({ users })
  }

  async getUserGameStatus(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { userGameStatus } = await this.userService.findUserGameStatus(
      gameId,
      userId
    )

    return reply.status(200).send({ userGameStatus })
  }

  async removeGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)
    const userId = request.user.userId
    const { game } = await this.userService.removeGame(gameId, userId)

    return reply.status(200).send({ game })
  }

  async updateGame(request: FastifyRequest, reply: FastifyReply) {
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { statusId } = UserSchema.UserGameBodySchema.parse(request.body)

    const { game, userGameStatus, playedCountUpdated } =
      await this.userService.updateGame(gameId, userId, statusId)

    return reply.status(200).send({ game, userGameStatus, playedCountUpdated })
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
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { playedCount } = await this.userService.findUserGameStats(
      gameId,
      userId
    )

    return reply.status(200).send({ playedCount })
  }

  async updateUserGamePlayedCount(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { gameId } = UserSchema.UserGameParamsSchema.parse(request.params)

    const userId = request.user.userId

    const { incrementValue } =
      UserSchema.UserGamePlayedCountUpdateBodySchema.parse(request.body)

    const { playedCount } = await this.userService.updateUserGamePlayedCount(
      userId,
      gameId,
      incrementValue
    )

    return reply.status(200).send({ playedCount })
  }

  async getGamesToDisplay(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const { game, message } = await this.userService.findGamesToDisplay(userId)

    return reply.status(200).send({ game, message })
  }
}
