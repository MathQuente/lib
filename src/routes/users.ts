import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

import * as UserSchema from '../schemas/user.schema'
import { UserRepository } from '../repositories/users.repository'
import { UserService } from '../services/users.service'
import { UserController } from '../controllers/users.controller'
import { GameRepository } from '../repositories/games.repository'
import { RatingRepository } from '../repositories/rating.repository'
import { ErrorSchemas } from '../schemas/error.schema'

export async function userRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const gameRepository = new GameRepository()
  const ratingRepository = new RatingRepository()
  const userService = new UserService(
    userRepository,
    gameRepository,
    ratingRepository
  )
  const userController = new UserController(userService)

  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          // 200: UserSchema.GetUserResponseSchema
        }
      }
    },
    async (request, reply) => userController.getMe(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        params: UserSchema.UserParamsSchema,
        response: {
          200: UserSchema.GetUserResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: UserSchema.QueryStringSchema,
        response: {
          200: UserSchema.GetAllUsersResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUsers(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/games/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          201: UserSchema.AddGameResponseSchema,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      userController.addGameToUserLibrary(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/games/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.RemoveGameResponseSchema,
          404: ErrorSchemas.NotFound,
          409: ErrorSchemas.BadRequest,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.removeGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/gameStatus/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.UpdateUserGameStatusResponseSchema,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.updateGame(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/gameStatus/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatusResponse,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUserGameStatus(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/userGames',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: UserSchema.QueryStringSchema,
        response: {
          200: UserSchema.GetAllUserGamesResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getAllUserGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        body: UserSchema.UpdateUserBodySchema,
        response: {
          200: UserSchema.UpdateUserResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.updateUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: UserSchema.DeleteUserResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.deleteUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/playedCount/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatsResponse,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUserGameStats(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/playedCount/:gameId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameStatsResponse,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      userController.updateUserGamePlayedCount(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/featuredGames',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: UserSchema.GetGamesToDisplayResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getGamesToDisplay(request, reply)
  )
}
