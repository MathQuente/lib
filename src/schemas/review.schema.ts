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

export const CommunityReviewsQueryStringSchema = z.object({
  pageIndex: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).optional()
})

const CommunityReviewSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string().nullable(),
  profilePicture: z.string().nullable(),
  rating: z.number().nullable(),
  hoursPlayed: z.number(),
  completions: z.number(),
  text: z.string(),
  createdAt: z.date()
})

export const GetCommunityReviewsResponseSchema = z.object({
  reviews: z.array(CommunityReviewSchema),
  total: z.number()
})
