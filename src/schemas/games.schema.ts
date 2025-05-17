import z from 'zod'

export const CreateGameDateReleaseBodySchema = z.object({
  dateRelease: z.coerce.date(),
  platformId: z.string().uuid()
})

export const CreateGameDateReleaseResponseSchema = z.object({
  gameDateRelease: z.object({
    dateRelease: z.coerce.date(),
    platforms: z.object({
      id: z.string().uuid(),
      platformName: z.string()
    })
  })
})

export const CreateGameResponseSchema = z.object({
  game: z.object({
    id: z.string().uuid(),
    gameName: z.string()
  })
})

export const DeleteGameResponseSchema = z.object({
  game: z.object({
    id: z.string().uuid(),
    gameName: z.string()
  })
})

export const GameBodySchema = z.object({
  gameName: z.string().min(1, {
    message: 'Game studio name field requires at least one character'
  }),
  gameBanner: z.string().min(1, { message: 'Game needs to have a banner' }),
  gameStudios: z.array(
    z.object({
      studioName: z
        .string()
        .min(1, { message: 'Game needs to have at least one game studio' })
    })
  ),
  categories: z.array(
    z.object({
      categoryName: z
        .string()
        .min(1, { message: 'Game needs to have at least one category' })
    })
  ),
  publishers: z.array(
    z.object({
      publisherName: z
        .string()
        .min(1, { message: 'Game needs to have at least one publisher' })
    })
  ),
  platforms: z.array(
    z.object({
      platformName: z
        .string()
        .min(1, { message: 'Game needs to have at least one platform' })
    })
  ),
  summary: z.string().min(1, { message: 'Game needs to have a summary' }),
  isDlc: z.boolean().default(false),
  parentGameId: z.string().nullable().optional()
})

export const GameParamsSchema = z.object({
  gameId: z.string().uuid()
})

export const GameQueryStringSchema = z.object({
  query: z.string().nullable(),
  pageIndex: z.coerce.number().default(0)
})

export const GetGameResponseSchema = z.object({
  game: z.object({
    id: z.string().uuid(),
    gameName: z.string(),
    gameBanner: z.string(),
    categories: z.array(
      z.object({
        id: z.number(),
        categoryName: z.string()
      })
    ),
    gameStudios: z.array(
      z.object({
        id: z.string().uuid(),
        studioName: z.string()
      })
    ),
    gameLaunchers: z.array(
      z.object({
        dateRelease: z.date(),
        platform: z.object({
          id: z.string().uuid(),
          platformName: z.string()
        })
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
    summary: z.string(),
    isDlc: z.boolean(),
    dlcs: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string()
      })
    ),
    parentGame: z
      .object({
        id: z.string(),
        gameName: z.string(),
        gameBanner: z.string()
      })
      .nullable()
  })
})

export const GetGamesResponseSchema = z.object({
  games: z.array(
    z.object({
      id: z.string().uuid(),
      gameName: z.string(),
      gameBanner: z.string(),
      categories: z.array(
        z.object({
          id: z.number(),
          categoryName: z.string()
        })
      ),
      gameStudios: z.array(
        z.object({
          id: z.string().uuid(),
          studioName: z.string()
        })
      ),
      gameLaunchers: z.array(
        z.object({
          dateRelease: z.date(),
          platform: z.object({
            id: z.string().uuid(),
            platformName: z.string()
          })
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
      summary: z.string(),
      isDlc: z.boolean(),
      dlcs: z.array(
        z.object({
          id: z.string().uuid(),
          gameName: z.string(),
          gameBanner: z.string()
        })
      ),
      parentGame: z
        .object({
          id: z.string(),
          gameName: z.string(),
          gameBanner: z.string()
        })
        .nullable()
    })
  ),
  total: z.number()
})

export const GetGameStatusResponseSchema = z.object({
  status: z.array(
    z.object({
      id: z.number(),
      status: z.string()
    })
  )
})

export const GetSimilarGamesResponseSchema = z.object({
  similarGames: z.array(
    z.object({
      id: z.string().uuid(),
      gameName: z.string(),
      gameBanner: z.string()
    })
  )
})

export const UpdateGameBodySchema = z.object({
  categories: z
    .array(
      z.object({
        categoryName: z.string()
      })
    )
    .optional(),
  gameBanner: z.string().optional(),
  gameName: z.string().optional(),
  gameStudios: z
    .array(
      z.object({
        studioName: z.string()
      })
    )
    .optional(),
  platforms: z
    .array(
      z.object({
        platformName: z.string()
      })
    )
    .optional(),
  publishers: z
    .array(
      z.object({
        publisherName: z.string()
      })
    )
    .optional(),
  summary: z.string().optional(),
  isDlc: z.boolean(),
  parentGameId: z.string().uuid()
})

export const UpdateGameResponseSchema = z.object({
  game: z.object({
    categories: z
      .array(
        z.object({
          categoryName: z.string()
        })
      )
      .optional(),
    gameBanner: z.string().optional(),
    gameName: z.string().optional(),
    gameStudios: z
      .array(
        z.object({
          studioName: z.string()
        })
      )
      .optional(),
    platforms: z
      .array(
        z.object({
          platformName: z.string()
        })
      )
      .optional(),
    publishers: z
      .array(
        z.object({
          publisherName: z.string()
        })
      )
      .optional(),
    summary: z.string().optional()
  })
})
