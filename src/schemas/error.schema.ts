import { z } from 'zod'

const problemFields = {
  type: z.string().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.union([z.number(), z.string()]).optional()
}

export const ErrorSchemas = {
  BadRequest: z.object({
    ...problemFields,
    message: z.string(),
    error: z.record(z.array(z.string())).optional()
  }),
  NotFound: z.object({
    ...problemFields,
    message: z.string()
  }),
  InternalServerError: z.object({
    ...problemFields,
    message: z.string()
  })
}
