import z from 'zod'

export const StartImportResponseSchema = z.object({
  status: z.literal('queued')
})

export const DisconnectParamsSchema = z.object({
  accountId: z.uuid()
})

export const DisconnectResponseSchema = z.void()

export const ImportSectionResultSchema = z.object({
  imported: z.number(),
  updated: z.number(),
  skipped: z.number(),
  notFound: z.array(z.string()),
  suggestions: z.number().optional()
})

export function importStatusResponseSchema<TResult extends z.ZodType>(
  result: TResult
) {
  return z.object({
    status: z.enum([
      'idle',
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed'
    ]),
    progress: z.number().optional(),
    result: result.optional(),
    error: z.string().optional(),
    finishedAt: z.number().optional(),
    cooldownUntil: z.number().optional()
  })
}
