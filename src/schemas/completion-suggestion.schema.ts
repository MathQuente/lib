import { z } from 'zod'
import { PlatformEnumSchema } from './user.schema'

export const SuggestionParamsSchema = z.object({
  igdbId: z.coerce.number().int()
})

export const SuggestionListQuerySchema = z.object({
  platform: PlatformEnumSchema.optional()
})

export const SuggestionListResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      igdbId: z.number(),
      name: z.string(),
      coverUrl: z.string().nullable(),
      platform: PlatformEnumSchema,
      hoursPlayed: z.number(),
      normallyHours: z.number().nullable(),
      achieved: z.number().nullable(),
      total: z.number().nullable(),
      lowConfidence: z.boolean(),
      createdAt: z.string()
    })
  )
})

export const SuggestionAcceptResponseSchema = z.object({
  igdbId: z.number(),
  status: z.literal('PLAYED'),
  completions: z.number(),
  canUndo: z.boolean()
})

export const SuggestionUndoResponseSchema = z.object({
  igdbId: z.number(),
  status: z.string(),
  completions: z.number()
})

export const SuggestionDismissResponseSchema = z.undefined()
