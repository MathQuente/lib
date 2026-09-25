import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

import * as UserSchema from '../schemas/user.schema'
import * as FollowSchema from '../schemas/follow.schema'
import { UserRepository } from '../repositories/users.repository'
import { UserService } from '../services/users.service'
import { UserController } from '../controllers/users.controller'
import { RatingRepository } from '../repositories/rating.repository'
import { GameCacheRepository } from '../repositories/game-cache.repository'
import { GameCacheService } from '../services/game-cache.service'
import { FollowRepository } from '../repositories/follow.repository'
import { ErrorSchemas } from '../schemas/error.schema'

export async function userRoutes(app: FastifyInstance) {
  const userRepository = new UserRepository()
  const ratingRepository = new RatingRepository()
  const gameCacheRepository = new GameCacheRepository()
  const gameCacheService = new GameCacheService(gameCacheRepository)
  const followRepository = new FollowRepository()
  const userService = new UserService(
    userRepository,
    ratingRepository,
    gameCacheService,
    followRepository
  )
  const userController = new UserController(userService)

  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: UserSchema.GetMeResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getMe(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId',
    {
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
    '/:userId/games',
    {
      schema: {
        params: UserSchema.UserParamsSchema,
        response: {
          200: UserSchema.GetAllUserGamesResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getPublicUserGames(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/followers',
    {
      schema: {
        params: UserSchema.UserParamsSchema,
        response: {
          200: FollowSchema.GetFollowersResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUserFollowers(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:userId/following',
    {
      schema: {
        params: UserSchema.UserParamsSchema,
        response: {
          200: FollowSchema.GetFollowingResponseSchema,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUserFollowing(request, reply)
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
    '/games/:igdbId',
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
    '/games/:igdbId',
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
    '/gameStatus/:igdbId',
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
    '/gameStatus/:igdbId',
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
    '/playedCount/:igdbId',
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
    '/playedCount/:igdbId',
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
    '/hoursPlayed/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameHoursResponse,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.getUserGameHours(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/hoursPlayed/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameHoursResponse,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) => userController.updateUserGameHours(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/completedAt/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameCompletedAtResponse,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      userController.getUserGameCompletedAt(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/completedAt/:igdbId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: UserSchema.UserGameParamsSchema,
        response: {
          200: UserSchema.GetUserGameCompletedAtResponse,
          400: ErrorSchemas.BadRequest,
          404: ErrorSchemas.NotFound,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async (request, reply) =>
      userController.updateUserGameCompletedAt(request, reply)
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
