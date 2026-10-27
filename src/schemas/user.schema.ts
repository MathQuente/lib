import z from 'zod'
import { isConsoleAllowed } from '../utils/platform-consoles'

export const DeleteUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    userName: z.string().nullable()
  })
})

export const UserParamsSchema = z.object({
  userId: z.string().uuid()
})

export const GetUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    userName: z.string().nullable(),
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable(),
    gamesAmount: z.number(),
    totalHoursPlayed: z.number(),
    followersCount: z.number(),
    followingCount: z.number()
  })
})

export const GetMeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable(),
    userName: z.string().nullable(),
    email: z.string(),
    emailVerified: z.boolean(),
    gamesAmount: z.number(),
    totalHoursPlayed: z.number(),
    steamId: z.string().nullable(),
    steamPersonaName: z.string().nullable(),
    psnOnlineId: z.string().nullable(),
    xboxGamertag: z.string().nullable(),
    followersCount: z.number(),
    followingCount: z.number()
  })
})

export const QueryStringSchema = z.object({
  pageIndex: z.coerce.number().int().min(0).max(10000).default(0),
  query: z.string().max(100).optional(),
  filter: z
    .enum(['PLAYED', 'PAUSED', 'PLAYING', 'BACKLOG', 'WISHLIST', 'DROPPED'])
    .optional()
    .catch(undefined),
  sortBy: z
    .enum([
      'gameName',
      'dateRelease',
      'rating',
      'dateAdded',
      'hoursPlayed',
      'completedAt'
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
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

export const UserGameBodySchema = z.object({
  statusId: z.number().int().min(1).max(6)
})

export const UserGameEndlessBodySchema = z.object({
  endless: z.boolean()
})

export const UpdateUserGameEndlessResponseSchema = z.object({
  igdbId: z.number(),
  endless: z.boolean()
})

export const UserGamePlayedCountUpdateBodySchema = z.object({
  incrementValue: z.number().int().min(-1).max(1)
})

export const UserGameHoursUpdateBodySchema = z.object({
  hoursPlayed: z.number().min(0).max(9999.99)
})

export const UserGameCompletedAtUpdateBodySchema = z.object({
  completedAt: z.string().date()
})

export const GetUserGameCompletedAtResponse = z.object({
  completedAt: z.string().nullable()
})

export const AddGameResponseSchema = z.object({
  igdbId: z.number()
})

export const RemoveGameResponseSchema = z.object({
  igdbId: z.number()
})

export const UpdateUserResponseSchema = z.object({
  user: z.object({
    profilePicture: z.string().nullable(),
    userBanner: z.string().nullable(),
    userName: z.string().nullable()
  })
})

export const GetUserGameStatusResponse = z.object({
  userGameStatus: z
    .object({
      id: z.number(),
      status: z.string()
    })
    .nullable(),
  endless: z.boolean(),
  hoursPlayed: z.number(),
  completions: z.number()
})

const UserGameEntrySchema = z.object({
  igdbId: z.number(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  platforms: z.array(z.string()).optional(),
  releaseDate: z.number().optional(),
  rating: z.number().nullable(),
  completions: z.number(),
  hoursPlayed: z.number(),
  playedOn: z.array(z.string()),
  status: z.string(),
  endless: z.boolean()
})

export const GetAllUserGamesResponseSchema = z.object({
  games: z.object({
    PLAYED: z.array(UserGameEntrySchema),
    PLAYING: z.array(UserGameEntrySchema),
    PAUSED: z.array(UserGameEntrySchema),
    BACKLOG: z.array(UserGameEntrySchema),
    WISHLIST: z.array(UserGameEntrySchema),
    DROPPED: z.array(UserGameEntrySchema)
  }),
  totalPerStatus: z.array(
    z.object({
      status: z.string(),
      totalGames: z.number()
    })
  ),
  total: z.number()
})

const ALLOWED_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'lh3.googleusercontent.com',
  'cdn.discordapp.com'
])

const ImageUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine(value => {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(url.hostname)
  }, 'URL de imagem não permitida.')

export const UpdateUserBodySchema = z
  .object({
    userName: z.string().trim().min(1).max(30).nullable(),
    profilePicture: ImageUrlSchema.nullable(),
    userBanner: ImageUrlSchema.nullable()
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

export const GetUserGameStatsResponse = z.object({
  playedCount: z.number()
})

export const GetUserGameHoursResponse = z.object({
  hoursPlayed: z.number()
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

export const PlatformEnumSchema = z.enum([
  'STEAM',
  'PLAYSTATION',
  'XBOX',
  'NINTENDO',
  'EPIC',
  'GOG',
  'OTHER'
])

export const ConsoleEnumSchema = z.enum([
  'UNKNOWN',
  'PS1',
  'PS2',
  'PS3',
  'PS4',
  'PS5',
  'PSP',
  'PS_VITA',
  'XBOX_ORIGINAL',
  'XBOX_360',
  'XBOX_ONE',
  'XBOX_SERIES',
  'NES',
  'SNES',
  'N64',
  'GAMECUBE',
  'WII',
  'WII_U',
  'SWITCH',
  'SWITCH_2',
  'GAME_BOY',
  'GAME_BOY_COLOR',
  'GAME_BOY_ADVANCE',
  'DS',
  'N3DS',
  'PC',
  'STEAM_DECK',
  'MASTER_SYSTEM',
  'MEGA_DRIVE',
  'SEGA_CD',
  'SATURN',
  'DREAMCAST',
  'GAME_GEAR',
  'ATARI_2600',
  'ATARI_7800',
  'NEO_GEO',
  'TURBOGRAFX',
  'MOBILE',
  'ARCADE'
])

export const UserGamePlatformParamsSchema = z
  .object({
    igdbId: z.coerce.number().int(),
    platform: PlatformEnumSchema,
    console: ConsoleEnumSchema
  })
  .refine(params => isConsoleAllowed(params.platform, params.console), {
    message: 'Console inválido para esta plataforma.',
    path: ['console']
  })

export const UserGamePlatformUpdateBodySchema = z
  .object({
    hoursPlayed: z.number().min(0).max(9999.99).nullable().optional(),
    completions: z.number().int().min(0).max(999).optional(),
    completedAt: z.string().date().nullable().optional()
  })
  .refine(body => Object.keys(body).length > 0, {
    message: 'Informe ao menos um campo para atualizar.'
  })

export const UserGamePlatformsResponseSchema = z.object({
  platforms: z.array(
    z.object({
      platform: PlatformEnumSchema,
      console: ConsoleEnumSchema,
      hoursPlayed: z.number().nullable(),
      completions: z.number(),
      completedAt: z.string().nullable()
    })
  ),
  totals: z.object({
    hoursPlayed: z.number(),
    completions: z.number(),
    completedAt: z.string().nullable()
  })
})
