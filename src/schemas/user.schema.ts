import { Status } from '@prisma/client'
import z from 'zod'

export const CreateUserResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid()
  })
})

export const DeleteUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    userName: z.string()
  })
})

export const LoginResponseSchema = z.object({
  token: z.string()
})

export const UserParamsSchema = z.object({
  userId: z.string().uuid()
})

export const GetUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable(),
    userName: z.string().nullable(),
    gamesAmount: z.number()
  })
})

export const QueryStringSchema = z.object({
  pageIndex: z.coerce.number().default(0),
  query: z.string().optional(),
  filter: z
    .enum(['PLAYED', 'PAUSED', 'PLAYING', 'BACKLOG', 'WISHLIST'])
    .optional(),
  sortBy: z
    .enum(['gameName', 'dateRelease', 'rating'])
    .optional()
    .default('gameName'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
})

export const GetAllUsersResponseSchema = z.object({
  users: z.array(
    z.object({
      id: z.string().uuid(),
      userBanner: z.string().nullable(),
      userName: z.string().nullable(),
      profilePicture: z.string().url().nullable(),
      userGamesAmount: z.number()
    })
  )
})

export const UserGameParamsSchema = z.object({
  gameId: z.string().uuid()
})

export const UserGamePlayedCountUpdateParamsSchema = z.object({
  userId: z.string().uuid(),
  gameId: z.string().uuid()
})

export const UserGameBodySchema = z.object({
  statusId: z.number()
})

export const UserGamePlayedCountUpdateBodySchema = z.object({
  incrementValue: z.number().int()
})

export const RemoveGameParamsSchema = z.object({
  itemId: z.string().uuid(),
  userId: z.string().uuid()
})

export const AddGameResponseSchema = z.object({
  game: z
    .object({
      id: z.string().uuid(),
      gameBanner: z.string(),
      gameName: z.string()
    })
    .optional(),
  dlc: z
    .object({
      id: z.string().uuid(),
      dlcBanner: z.string(),
      dlcName: z.string()
    })
    .optional()
})

export const RemoveGameResponseSchema = z.object({
  game: z
    .object({
      id: z.string().uuid(),
      gameBanner: z.string(),
      gameName: z.string()
    })
    .optional(),
  dlc: z
    .object({
      id: z.string().uuid(),
      dlcBanner: z.string(),
      dlcName: z.string()
    })
    .optional()
})

export const GetUserGameStatusParamsSchema = z.object({
  userId: z.string().uuid(),
  itemId: z.string().uuid()
})

export const UpdateUserResponseSchema = z.object({
  user: z.object({
    profilePicture: z.string(),
    userBanner: z.string().nullable(),
    userName: z.string()
  })
})

export const UpdateUserGameStatusBody = z.object({
  statusIds: z.number()
})

export const GetUserGameStatusResponse = z.object({
  userGameStatus: z
    .object({
      id: z.number(),
      status: z.string()
    })
    .nullable()
})

export const GetAllUserGamesResponseSchema = z.object({
  games: z.object({
    PLAYED: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string().url(),
        gameLaunchers: z.array(
          z.object({
            dateRelease: z.coerce.date(),
            platformId: z.string().uuid(),
            platforms: z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          })
        ),
        isDlc: z.boolean(),
        status: z.string()
      })
    ),
    PLAYING: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string().url(),
        gameLaunchers: z.array(
          z.object({
            dateRelease: z.coerce.date(),
            platformId: z.string().uuid(),
            platforms: z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          })
        ),
        isDlc: z.boolean(),
        status: z.string()
      })
    ),
    PAUSED: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string().url(),
        gameLaunchers: z.array(
          z.object({
            dateRelease: z.coerce.date(),
            platformId: z.string().uuid(),
            platforms: z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          })
        ),
        isDlc: z.boolean(),
        status: z.string()
      })
    ),
    BACKLOG: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string().url(),
        gameLaunchers: z.array(
          z.object({
            dateRelease: z.coerce.date(),
            platformId: z.string().uuid(),
            platforms: z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          })
        ),
        isDlc: z.boolean(),
        status: z.string()
      })
    ),
    WISHLIST: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string().url(),
        gameLaunchers: z.array(
          z.object({
            dateRelease: z.coerce.date(),
            platformId: z.string().uuid(),
            platforms: z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          })
        ),
        isDlc: z.boolean(),
        status: z.string()
      })
    )
  }),
  totalPerStatus: z.array(
    z.object({
      status: z.string(),
      totalGames: z.number()
    })
  )
})

export const UpdateUserBodySchema = z
  .object({
    userName: z.string().nullable(),
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable()
  })
  .partial()

export const UpdateUserGameStatusResponseSchema = z.object({
  game: z.object({
    id: z.string().uuid(),
    gameBanner: z.string(),
    gameName: z.string()
  }),
  userGameStatus: z.object({
    id: z.number(),
    status: z.string()
  }),
  playedCountUpdated: z.number()
})

export const UserBodySchema = z.object({
  email: z.string().email().min(1, 'Email is a required field.'),
  password: z.string().min(6, 'Password required at least 6 characters.')
})

export const GetUserGameStatsResponse = z.object({
  playedCount: z.number()
})

export const GetGamesToDisplayResponseSchema = z.object({
  game: z
    .union([
      z.object({
        id: z.string().uuid(),
        gameBanner: z.string().url(),
        gameName: z.string(),
        isDlc: z.boolean()
      }),
      z.object({
        id: z.string().uuid(),
        gameBanner: z.string().url(),
        gameName: z.string(),
        userGames: z.array(
          z.object({
            userId: z.string().uuid(),
            UserGamesStatus: z.object({
              status: z.nativeEnum(Status)
            })
          })
        )
      })
    ])
    .nullable()
    .optional(),
  message: z.string()
})
