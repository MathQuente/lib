import z from 'zod'

export const CreateDlcBodySchema = z.object({
  dlcName: z.string().min(1, {
    message: 'Game studio name field requires at least one character'
  }),
  dlcBanner: z.string().min(1, { message: 'Game needs to have a banner' }),
  gameStudios: z.array(
    z.object({
      studioName: z
        .string()
        .min(1, { message: 'Game needs to have at least one game studio' })
    })
  ),
  categories: z.array(
    z.object({
      categoryName: z
        .string()
        .min(1, { message: 'Game needs to have at least one category' })
    })
  ),
  publishers: z.array(
    z.object({
      publisherName: z
        .string()
        .min(1, { message: 'Game needs to have at least one publisher' })
    })
  ),
  platforms: z.array(
    z.object({
      platformName: z
        .string()
        .min(1, { message: 'Game needs to have at least one platform' })
    })
  ),
  summary: z.string().min(1, { message: 'Game needs to have a summary' })
})

export const CreateDlcResponseSchema = z.object({
  dlc: z.object({
    id: z.string().uuid(),
    dlcName: z.string()
  })
})
