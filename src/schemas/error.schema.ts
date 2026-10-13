import { z } from 'zod'

export const ErrorSchemas = {
  BadRequest: z.object({
    message: z.string(),
    error: z.record(z.array(z.string())).optional()
  }),
  NotFound: z.object({
    message: z.string()
  }),
  InternalServerError: z.object({
    message: z.string()
  })
}
