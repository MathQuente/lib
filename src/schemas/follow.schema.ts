import z from 'zod'

export const FollowParamsSchema = z.object({
  userId: z.uuid()
})

const FollowSummarySchema = z.object({
  id: z.uuid(),
  userName: z.string().nullable(),
  profilePicture: z.string().nullable()
})

export const IsFollowingResponseSchema = z.object({
  isFollowing: z.boolean()
})

export const GetFollowersResponseSchema = z.object({
  followers: z.array(FollowSummarySchema)
})

export const GetFollowingResponseSchema = z.object({
  following: z.array(FollowSummarySchema)
})

export const FollowActionResponseSchema = z.void()
