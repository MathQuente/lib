import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { authMiddleware } from '../middleware/auth.middleware'
import * as UserSchema from '../schemas/user.schema'
import { UserRepository } from '../repositories/users.repository'
import { UserService } from '../services/users.service'
import { UserController } from '../controllers/users.controller'
import { GameRepository } from '../repositories/games.repository'

export async function userRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameRepository = new GameRepository()
  const userService = new UserService(userRepository, gameRepository)
  const userController = new UserController(userService)

  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      onRequest: [authMiddleware],
      schema: {
        response: {
          200: UserSchema.GetUserResponseSchema
        }
      }
    },
    async (request, reply) => userController.getMe(request, reply)
  )

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
    '/:userId/games/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          201: UserSchema.AddGameResponseSchema
        }
      }
    },
    async (request, reply) =>
      userController.addGameToUserLibrary(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:userId/games/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          201: UserSchema.RemoveGameResponseSchema
        }
      }
    },
    async (request, reply) => userController.removeGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:userId/gameStatus/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.UpdateUserGameStatusResponseSchema
        }
      }
    },
    async (request, reply) => userController.updateGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatusResponse
        }
      }
    },
    async (request, reply) => userController.getUserGameStatus(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/userGames',
    {
      onRequest: [authMiddleware],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        params: UserSchema.UserParamsSchema,
        response: {
          200: UserSchema.GetAllUserGamesResponseSchema
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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/gameInfo/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatsResponse
        }
      }
    },
    async (request, reply) => userController.getUserGameStats(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:userId/playedCount/:gameId',
    {
      onRequest: [authMiddleware],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatsResponse
        }
      }
    },
    async (request, reply) =>
      userController.updateUserGamePlayedCount(request, reply)
  )
}
