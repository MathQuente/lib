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
  query: z.string().optional(),
  filter: z.coerce.number().optional(),
  pageIndex: z.coerce.number().default(0)
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
  gameId: z.string().uuid(),
  userId: z.string().uuid()
})

export const UserGamePlayedCountUpdateParamsSchema = z.object({
  userId: z.string().uuid(),
  gameId: z.string().uuid()
})

export const UserGameBodySchema = z.object({
  statusIds: z
    .array(z.number())
    .min(1, { message: 'pelo menos um status deve ser informado' })
    .refine(
      arr =>
        arr.every(id => [/* ids permitidos, ex: */ 1, 2, 3, 4, 5].includes(id)),
      { message: 'status inválido na lista' }
    )
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
    userBanner: z.string(),
    userName: z.string()
  })
})

export const GetUserGameStatusResponse = z.object({
  userGameStatuses: z.array(
    z.object({
      id: z.number(),
      status: z.string()
    })
  )
})

export const GetAllUserGamesResponseSchema = z.object({
  userGames: z.array(
    z.object({
      id: z.string().uuid(),
      gameName: z.string(),
      gameBanner: z.string().url(),
      isDlc: z.boolean(),
      statuses: z.array(z.string())
    })
  ),
  totalPerStatus: z.array(
    z.object({
      status: z.string(),
      totalGames: z.number()
    })
  ),
  totalGames: z.number()
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
  statuses: z.array(
    z.object({
      id: z.number(),
      status: z.string()
    })
  )
})

export const UserBodySchema = z.object({
  email: z.string().email().min(1, 'Email is a required field.'),
  password: z.string().min(6, 'Password required at least 6 characters.')
})

export const GetUserGameStatsResponse = z.object({
  userGameStats: z.object({
    completions: z.number()
  })
})
