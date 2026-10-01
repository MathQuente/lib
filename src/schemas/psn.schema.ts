import z from 'zod'

export const ConnectPsnBodySchema = z.object({
  onlineId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,16}$/, 'ID da PSN inválido.')
})

export const ConnectPsnResponseSchema = z.object({
  psnOnlineId: z.string()
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
