import z from 'zod'

enum Status {
  PLAYED = 'PLAYED',
  REPLAYING = 'REPLAYING',
  PLAYING = 'PLAYING',
  BACKLOG = 'BACKLOG',
  WISHLIST = 'WISHLIST'
}

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
      userBanner: z.string().nullish(),
      userName: z.string(),
      profilePicture: z.string().nullish()
    })
  )
})

export const UserGameParamsSchema = z.object({
  itemId: z.string().uuid(),
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
  UserGamesStatus: z.object({
    id: z.number(),
    status: z.string()
  })
})

export const GetAllUserGamesResponseSchema = z.object({
  userGames: z.array(
    z.object({
      dlc: z
        .object({
          id: z.string().uuid(),
          categories: z.array(
            z.object({
              id: z.number(),
              categoryName: z.string()
            })
          ),
          dlcBanner: z.string().url(),
          dlcName: z.string(),
          gameLaunchers: z
            .array(
              z.object({
                dateRelease: z.date(),
                platforms: z.object({
                  id: z.string().uuid(),
                  platformName: z.string()
                })
              })
            )
            .nullish(),
          game: z.object({
            id: z.string().uuid(),
            gameBanner: z.string().url()
          }),
          gameStudios: z.array(
            z.object({
              id: z.string().uuid(),
              studioName: z.string()
            })
          ),
          platforms: z.array(
            z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          ),
          publishers: z.array(
            z.object({
              id: z.string().uuid(),
              publisherName: z.string()
            })
          ),
          summary: z.string()
        })
        .optional(),
      game: z
        .object({
          id: z.string().uuid(),
          categories: z.array(
            z.object({
              id: z.number(),
              categoryName: z.string()
            })
          ),
          dlcs: z.array(
            z.object({
              id: z.string().uuid(),
              dlcName: z.string(),
              dlcBanner: z.string().url()
            })
          ),
          gameName: z.string(),
          gameBanner: z.string().url(),
          gameLaunchers: z
            .array(
              z.object({
                dateRelease: z.date(),
                platforms: z.object({
                  id: z.string().uuid(),
                  platformName: z.string()
                })
              })
            )
            .nullish(),
          gameStudios: z.array(
            z.object({
              id: z.string().uuid(),
              studioName: z.string()
            })
          ),
          platforms: z.array(
            z.object({
              id: z.string().uuid(),
              platformName: z.string()
            })
          ), // Corrigido para array
          publishers: z.array(
            z.object({
              id: z.string().uuid(),
              publisherName: z.string()
            })
          ),
          summary: z.string()
        })
        .optional() // Permitir que o `game` esteja ausente
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
