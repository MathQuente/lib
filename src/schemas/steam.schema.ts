import z from 'zod'
import {
  ImportSectionResultSchema,
  importStatusResponseSchema
} from './import.schema'

export {
  DisconnectResponseSchema,
  StartImportResponseSchema
} from './import.schema'

export const StartSteamLinkResponseSchema = z.object({
  url: z.string().url()
})

export const ImportStatusResponseSchema = importStatusResponseSchema(
  z.object({
    library: ImportSectionResultSchema,
    wishlist: ImportSectionResultSchema
  })
)
