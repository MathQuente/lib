import { z } from 'zod'

export const GameStudioBodySchema = z.object({
  studioName: z.string().min(1, {
    message: 'Game studio name field requires at least one character'
  })
})
export const CreateGameStudioResponseSchema = z.object({
  gameStudioId: z.string().uuid()
})

export const GameStudioParamsSchema = z.object({
  gameStudioId: z.string().uuid()
})

export const GameStudioQueryStringSchema = z.object({
  pageIndex: z.coerce.number().default(0)
})

export const GetStudioResponseSchema = z.object({
  gameStudio: z.object({
    id: z.string().uuid(),
    studioName: z.string(),
    gamesAndDlcsAmount: z.object({
      total: z.number(),
      games: z.number(),
      dlcs: z.number()
    }),
    games: z.array(
      z.object({
        id: z.string().uuid(),
        gameBanner: z.string()
      })
    ),
    dlcs: z.array(
      z.object({
        id: z.string().uuid(),
        dlcBanner: z.string()
      })
    )
  })
})

export const GetAllStudiosResponseSchema = z.object({
  gameStudios: z.array(
    z.object({
      id: z.string().uuid(),
      studioName: z.string(),
      gamesAndDlcsAmount: z.object({
        games: z.number(),
        dlcs: z.number()
      })
    })
  )
})

export const DeleteStudioResponseSchema = z.object({
  gameStudio: z.object({
    id: z.string().uuid(),
    studioName: z.string()
  })
})

export const UpdateStudioResponseSchema = z.object({
  gameStudio: z.object({
    id: z.string().uuid(),
    studioName: z.string()
  })
})
