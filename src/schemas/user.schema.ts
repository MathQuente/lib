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
    .optional()
    .catch(undefined),
  sortBy: z
    .enum(['gameName', 'dateRelease', 'rating'])
    .catch('gameName'),
  sortOrder: z.enum(['asc', 'desc']).catch('asc')
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
  igdbId: z.coerce.number().int()
})

export const UserGamePlayedCountUpdateParamsSchema = z.object({
  userId: z.string().uuid(),
  igdbId: z.coerce.number().int()
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
  igdbId: z.number()
})

export const RemoveGameResponseSchema = z.object({
  igdbId: z.number()
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

const UserGameEntrySchema = z.object({
  igdbId: z.number(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  platforms: z.array(z.string()).optional(),
  releaseDate: z.number().optional(),
  siteRating: z.number().nullable(),
  status: z.string()
})

export const GetAllUserGamesResponseSchema = z.object({
  games: z.object({
    PLAYED: z.array(UserGameEntrySchema),
    PLAYING: z.array(UserGameEntrySchema),
    PAUSED: z.array(UserGameEntrySchema),
    BACKLOG: z.array(UserGameEntrySchema),
    WISHLIST: z.array(UserGameEntrySchema)
  }),
  totalPerStatus: z.array(
    z.object({
      status: z.string(),
      totalGames: z.number()
    })
  ),
  total: z.number()
})

export const UpdateUserBodySchema = z
  .object({
    userName: z.string().nullable(),
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable()
  })
  .partial()

export const UpdateUserGameStatusResponseSchema = z.object({
  igdbId: z.number(),
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
    .object({
      igdbId: z.number(),
      name: z.string(),
      coverUrl: z.string().nullable()
    })
    .nullable()
    .optional(),
  message: z.string()
})
