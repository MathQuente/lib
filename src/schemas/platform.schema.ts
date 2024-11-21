import { z } from 'zod'

export const PlatformBodySchema = z.object({
  platformName: z
    .string()
    .min(1, { message: 'Platform name field requires at least one character' })
})

export const CreatePlatformResponseSchema = z.object({
  platformId: z.string().uuid()
})

export const PlatformParamsSchema = z.object({
  platformId: z.string().uuid()
})

export const GetPlatformResponseSchema = z.object({
  platform: z.object({
    id: z.string().uuid(),
    platformName: z.string(),
    games: z.array(
      z.object({
        id: z.string().uuid(),
        gameName: z.string(),
        gameBanner: z.string()
      })
    ),
    dlcs: z.array(
      z.object({
        id: z.string().uuid(),
        dlcName: z.string(),
        dlcBanner: z.string()
      })
    ),
    gamesAndDlcsAmount: z.object({
      games: z.number(),
      dlcs: z.number()
    })
  })
})

export const PlatformQueryStringSchema = z.object({
  pageIndex: z.coerce.number().default(0)
})

export const GetAllPlatformsResponseSchema = z.object({
  platforms: z.array(
    z.object({
      id: z.string().uuid(),
      platformName: z.string(),
      games: z.array(
        z.object({
          id: z.string().uuid(),
          gameName: z.string(),
          gameBanner: z.string()
        })
      ),
      dlcs: z.array(
        z.object({
          id: z.string().uuid(),
          dlcName: z.string(),
          dlcBanner: z.string()
        })
      ),
      gamesAndDlcsAmount: z.object({
        games: z.number(),
        dlcs: z.number()
      })
    })
  )
})

export const DeletePlatformResponseSchema = z.object({
  platform: z.object({
    id: z.string().uuid(),
    platformName: z.string()
  })
})

export const UpdatedPlatformResponseSchema = z.object({
  platform: z.object({
    id: z.string().uuid(),
    platformName: z.string()
  })
})
