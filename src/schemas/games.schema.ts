import z from 'zod'

export const CreateGameDateReleaseBodySchema = z.object({
  dateRelease: z.coerce.date(),
  platformId: z.string().uuid()
})

export const CreateGameDateReleaseResponseSchema = z.object({
  gameDateRelease: z.object({
    dateRelease: z.coerce.date(),
    platformId: z.string().uuid(),
    platformName: z.string()
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
  summary: z.string().min(1, { message: 'Game needs to have a summary' })
})

export const GameParamsSchema = z.object({
  gameId: z.string().uuid()
})

export const GameQueryStringSchema = z.object({
  query: z.string().nullish(),
  pageIndex: z.coerce.number().default(0)
})

export const GetGameResponseSchema = z.object({
  game: z.object({
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
        dlcBanner: z.string(),
        dlcName: z.string()
      })
    ),
    gameBanner: z.string(),
    gameName: z.string(),
    gameStudios: z.array(
      z.object({
        studioName: z.string()
      })
    ),
    gameLaunchers: z.array(
      z.object({
        dateRelease: z.date(),
        platformId: z.string().uuid(),
        platform: z.object({
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
    )
  })
})

export const GetGamesResponseSchema = z.object({
  gamesAndDlcs: z.object({
    games: z.array(
      z.object({
        id: z.string().uuid(),
        categories: z.array(
          z.object({
            id: z.number(),
            categoryName: z.string()
          })
        ),
        dlcs: z
          .array(
            z.object({
              id: z.string().uuid(),
              dlcBanner: z.string(),
              dlcName: z.string()
            })
          )
          .nullish(),
        gameBanner: z.string(),
        gameName: z.string(),
        gameStudios: z.array(
          z.object({
            studioName: z.string()
          })
        ),
        gameLaunchers: z
          .array(
            z.object({
              gameLauncher: z.object({
                dateRelease: z.date(),
                id: z.string().uuid(),
                platform: z.string()
              })
            })
          )
          .nullish(),
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
        )
      })
    ),
    dlcs: z.array(
      z.object({
        id: z.string().uuid(),
        categories: z.array(
          z.object({
            id: z.number(),
            categoryName: z.string()
          })
        ),
        dlcBanner: z.string(),
        dlcName: z.string(),
        game: z.object({
          id: z.string().uuid(),
          gameBanner: z.string(),
          gameName: z.string()
        }),
        gameStudios: z.array(
          z.object({
            studioName: z.string()
          })
        ),
        gameLaunchers: z
          .array(
            z.object({
              gameLauncher: z.object({
                dateRelease: z.date(),
                id: z.string().uuid(),
                platform: z.string()
              })
            })
          )
          .nullish(),
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
        )
      })
    )
  })
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
  summary: z.string().optional()
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
