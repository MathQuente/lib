import z from 'zod'

export const ConnectSteamBodySchema = z.object({
  profileInput: z.string().min(1)
})

export const ConnectSteamResponseSchema = z.object({
  steamId: z.string()
})

export const StartImportResponseSchema = z.object({
  status: z.literal('queued')
})

const SteamImportSectionResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  notFound: z.array(z.string())
})

export const ImportStatusResponseSchema = z.object({
  status: z.enum([
    'idle',
    'waiting',
    'active',
    'delayed',
    'completed',
    'failed'
  ]),
  result: z
    .object({
      library: SteamImportSectionResultSchema,
      wishlist: SteamImportSectionResultSchema
    })
    .optional(),
  error: z.string().optional()
})
