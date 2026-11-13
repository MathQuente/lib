import z from 'zod'
import {
  ImportSectionResultSchema,
  importStatusResponseSchema
} from './import.schema'

export {
  DisconnectParamsSchema,
  DisconnectResponseSchema,
  StartImportResponseSchema
} from './import.schema'

export const StartSteamLinkResponseSchema = z.object({
  url: z.url()
})

export const ImportStatusResponseSchema = importStatusResponseSchema(
  z.object({
    library: ImportSectionResultSchema,
    wishlist: ImportSectionResultSchema,
    accounts: z
      .array(
        z.object({
          displayName: z.string(),
          library: ImportSectionResultSchema.optional(),
          error: z.string().optional()
        })
      )
      .optional()
  })
)
