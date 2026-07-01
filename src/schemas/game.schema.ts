import { z } from 'zod'

export const IGDBGameSchema = z.object({
  igdbId: z.number(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  summary: z.string().optional(),
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  releaseDate: z.number().optional(),
  siteRating: z.number().nullable(),
  developers: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  // IGDB category id (0=main_game, 1=dlc_addon, 2=expansion, 8=remake, 9=remaster, ...),
  // or -1 when IGDB has no category for this entry (common even for real DLCs/remasters).
  category: z.number(),
  // Presence of parentGameId is the reliable "this is DLC/related content" signal,
  // since category is often missing even when this isn't.
  parentGameId: z.number().nullable()
})

export const GameParamsSchema = z.object({
  igdbId: z.coerce.number().int()
})

export const GameQueryStringSchema = z.object({
  query: z.string().optional(),
  pageIndex: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  sortBy: z.enum(['name', 'release_date', 'rating']).catch('release_date'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc')
})

export const ComingSoonQueryStringSchema = z.object({
  limit: z.coerce.number().default(36),
  pageIndex: z.coerce.number().default(0)
})

export const GetGameResponseSchema = z.object({
  game: IGDBGameSchema,
  relatedGames: z.array(IGDBGameSchema)
})

export const GetGamesResponseSchema = z.object({
  games: z.array(IGDBGameSchema),
  total: z.number()
})

export const GetSimilarGamesResponseSchema = z.object({
  similarGames: z.array(IGDBGameSchema)
})

export const GetFeaturedGamesResponseSchema = z.object({
  mostRatedGames: z.array(IGDBGameSchema),
  trendingGames: z.array(IGDBGameSchema),
  recentGames: z.array(IGDBGameSchema),
  futureGames: z.array(IGDBGameSchema)
})
