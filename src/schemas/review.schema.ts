import z from 'zod'

export const ReviewParamsSchema = z.object({
  igdbId: z.coerce.number().int()
})

export const ReviewBodySchema = z.object({
  text: z.string().trim().min(1).max(2000)
})

const ReviewSchema = z.object({
  text: z.string(),
  updatedAt: z.date()
})

export const UpsertReviewResponseSchema = z.object({
  review: ReviewSchema
})

export const GetReviewResponseSchema = z.object({
  review: ReviewSchema.nullable()
})

export const DeleteReviewResponseSchema = z.void()
