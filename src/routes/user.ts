import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { authMiddleware } from '../middleware/auth.middleware'
import * as UserSchema from '../schemas/users.schema'
import { UserRepository } from '../repositories/users.repository'
import { UserService } from '../services/users.service'
import { UserController } from '../controllers/users.controller'
import { GameRepository } from '../repositories/games.repository'
import { DlcRepository } from '../repositories/dlcs.repository'

export async function userRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameRepository = new GameRepository()
  const dlcRepository = new DlcRepository()
  const userService = new UserService(
    userRepository,
    gameRepository,
    dlcRepository
  )
  const userController = new UserController(userService)

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId',
    {
      onRequest: [authMiddleware],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        params: UserSchema.UserParamsSchema,
        response: {
          200: UserSchema.GetUserResponseSchema
        }
      }
    },
    async (request, reply) => userController.getUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      onRequest: [authMiddleware],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        response: {
          200: UserSchema.GetAllUsersResponseSchema
        }
      }
    },
    async (request, reply) => userController.getUsers(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/:userId/addGame/:itemId/:statusId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          201: UserSchema.AddGameResponseSchema
        }
      }
    },
    async (request, reply) => userController.addGameOrDlc(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:userId/removeItem/:itemId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.RemoveGameParamsSchema,
        response: {
          201: UserSchema.RemoveGameResponseSchema
        }
      }
    },
    async (request, reply) => userController.removeGameOrDlc(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/userGamesStatus/:userId/:itemId/:statusId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.UpdateUserGameStatusResponseSchema
        }
      }
    },
    async (request, reply) => userController.updateGameOrDlc(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/:itemId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.GetUserGameStatusParamsSchema,
        response: {
          // 200: UserSchema.GetUserGameStatusResponse
        }
      }
    },
    async (request, reply) =>
      userController.getUserGameOrDlcStatus(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/userGames',
    {
      onRequest: [authMiddleware],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        params: UserSchema.UserParamsSchema,
        response: {
          // 200: UserSchema.GetAllUserGamesResponseSchema
        }
      }
    },
    async (request, reply) => userController.getAllUserGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:userId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserParamsSchema,
        body: UserSchema.UpdateUserBodySchema,
        response: {
          200: UserSchema.UpdateUserResponseSchema
        }
      }
    },
    async (request, reply) => userController.updateUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:userId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserParamsSchema,
        response: {
          200: UserSchema.DeleteUserResponseSchema
        }
      }
    },
    async (request, reply) => userController.deleteUser(request, reply)
  )
}
