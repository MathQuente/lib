import z from 'zod'

export const ConnectXboxBodySchema = z.object({
  gamertag: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N} ]{1,15}(#\d{1,6})?$/u, 'Gamertag inválida.')
})

export const ConnectXboxResponseSchema = z.object({
  xboxGamertag: z.string()
})

export const DisconnectResponseSchema = z.void()

export const StartImportResponseSchema = z.object({
  status: z.literal('queued')
})

const ImportSectionResultSchema = z.object({
  imported: z.number(),
  updated: z.number(),
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
  progress: z.number().optional(),
  result: z
    .object({
      library: ImportSectionResultSchema
    })
    .optional(),
  error: z.string().optional(),
  cooldownUntil: z.number().optional()
})
