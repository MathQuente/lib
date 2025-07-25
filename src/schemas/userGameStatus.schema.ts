import { z } from 'zod'

export const GetGameStatusResponseSchema = z.object({
  status: z.array(
    z.object({
      id: z.number(),
      status: z.string()
    })
  )
})
