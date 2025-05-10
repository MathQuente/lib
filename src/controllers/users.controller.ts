import { FastifyReply, FastifyRequest } from 'fastify'
import { UserService } from '../services/users.service'
import * as UserSchema from '../schemas/users.schema'

export class UserController {
  constructor(private userService: UserService) {}

  async addGameOrDlc(request: FastifyRequest, reply: FastifyReply) {
    const { itemId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { statusIds } = UserSchema.UserGameBodySchema.parse(request.body)

    const addItem = await this.userService.addGameOrDlc(
      itemId,
      userId,
      statusIds
    )

    return reply.send(addItem)
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.deleteUser(userId)

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

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.findUser(userId)

    return reply.send({ user })
  }

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    const { pageIndex, query } = UserSchema.QueryStringSchema.parse(
      request.query
    )

    const { users } = await this.userService.findManyUsers(pageIndex, query)

    return reply.send({ users })
  }

  async getUserGameOrDlcStatus(request: FastifyRequest, reply: FastifyReply) {
    const { itemId, userId } = UserSchema.GetUserGameStatusParamsSchema.parse(
      request.params
    )

    const itemStatus = await this.userService.findUserGameStatus(itemId, userId)

    return reply.send(itemStatus)
  }

  async removeGameOrDlc(request: FastifyRequest, reply: FastifyReply) {
    const { itemId, userId } = UserSchema.RemoveGameParamsSchema.parse(
      request.params
    )

    const removeItem = await this.userService.removeGameOrDlc(itemId, userId)

    return reply.send(removeItem)
  }

  async updateGameOrDlc(request: FastifyRequest, reply: FastifyReply) {
    const { itemId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { statusIds } = UserSchema.UserGameBodySchema.parse(request.body)

    const updateItem = await this.userService.updateGameOrDlc(
      itemId,
      userId,
      statusIds
    )

    return reply.send(updateItem)
  }

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { profilePicture, userBanner, userName } =
      UserSchema.UpdateUserBodySchema.parse(request.body)

    const { userId } = UserSchema.UserParamsSchema.parse(request.params)

    const { user } = await this.userService.updateUser(userId, {
      profilePicture,
      userBanner,
      userName
    })

    return reply.send({ user })
  }

  async getUserGameStats(request: FastifyRequest, reply: FastifyReply) {
    const { itemId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const UserGameStats = await this.userService.findUserGameStats(
      userId,
      itemId
    )

    return reply.send({ UserGameStats })
  }

  async updateuserGamePlayedCount(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { itemId, userId } = UserSchema.UserGameParamsSchema.parse(
      request.params
    )

    const { incrementValue } =
      UserSchema.UserGamePlayedCountUpdateBodySchema.parse(request.body)

    const updateItem = await this.userService.updateUserGamePlayedCount(
      userId,
      itemId,
      incrementValue
    )

    return reply.send(updateItem)
  }
}
