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

export const ConnectPsnBodySchema = z.object({
  onlineId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,16}$/, 'ID da PSN inválido.')
})

export const StartPsnVerificationResponseSchema = z.object({
  psnOnlineId: z.string(),
  code: z.string(),
  expiresInSeconds: z.number()
})

export const ConnectPsnResponseSchema = z.object({
  psnOnlineId: z.string()
})

export const ImportStatusResponseSchema = importStatusResponseSchema(
  z.object({
    library: ImportSectionResultSchema,
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
