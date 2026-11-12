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

export const StartXboxLinkResponseSchema = z.object({
  url: z.string().url()
})

export const ImportStatusResponseSchema = importStatusResponseSchema(
  z.object({
    library: ImportSectionResultSchema,
    accounts: z
      .array(
        z.object({
          gamertag: z.string(),
          library: ImportSectionResultSchema.optional(),
          error: z.string().optional(),
          warning: z.string().optional()
        })
      )
      .optional()
  })
)
