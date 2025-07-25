import { z } from 'zod'

export const CreateReleaseParamsSchema = z.object({
  gameId: z.string().uuid()
})

export const CreateGameDateReleaseBodySchema = z.object({
  dateRelease: z.coerce.date(),
  platformId: z.string().uuid()
})

export const CreateGameDateReleaseResponseSchema = z.object({
  gameDateRelease: z.object({
    dateRelease: z.coerce.date(),
    platforms: z.object({
      id: z.string().uuid(),
      platformName: z.string()
    })
  })
})
