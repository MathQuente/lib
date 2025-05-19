import z from 'zod'

export const RatingParamsSchema = z.object({
  gameId: z.string().uuid()
})

export const RatingBodySchema = z.object({
  value: z.coerce.number().min(0).max(5)
})

export const RatingResponseSchema = z.object({
  rating: z.number().nullable()
})

export const GetRatingsResponseSchema = z.object({
  ratings: z.array(
    z.object({
      user: z.object({
        id: z.string().uuid(),
        userName: z.string(),
        profilePicture: z.string().url().nullable()
      }),
      value: z.number()
    })
  )
})
