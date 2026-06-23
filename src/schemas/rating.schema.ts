import z from 'zod'

export const RatingParamsSchema = z.object({
  igdbId: z.coerce.number().int()
})

export const RatingBodySchema = z.object({
  value: z.coerce.number().min(0).max(5)
})

export const CreateRatingResponseSchema = z.object({
  rating: z.number()
})

export const GetRatingResponseSchema = z.object({
  rating: z.number().nullable()
})

export const GetRatingAverageResponseSchema = z.object({
  average: z.number()
})

export const DeleteRatingResponseSchema = z.void()

export const GetRatingDistributionResponseSchema = z.object({
  ratings: z.array(
    z.object({
      rating: z.number(),
      count: z.number()
    })
  )
})

export const GetManyRatingsByGameResponseSchema = z.object({
  ratings: z.number()
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
