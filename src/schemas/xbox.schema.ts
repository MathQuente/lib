import z from 'zod'

export const StartXboxLinkResponseSchema = z.object({
  url: z.string().url()
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
