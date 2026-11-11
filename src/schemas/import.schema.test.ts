import { describe, it, expect } from 'vitest'
import {
  ImportSectionResultSchema,
  StartImportResponseSchema,
  importStatusResponseSchema
} from './import.schema'
import * as SteamSchema from './steam.schema'
import * as PsnSchema from './psn.schema'
import * as XboxSchema from './xbox.schema'

const section = { imported: 3, updated: 1, skipped: 0, notFound: ['A'] }

describe('import schemas', () => {
  it('accepts only the queued status when an import starts', () => {
    expect(
      StartImportResponseSchema.safeParse({ status: 'queued' }).success
    ).toBe(true)
    expect(
      StartImportResponseSchema.safeParse({ status: 'done' }).success
    ).toBe(false)
  })

  it('keeps the suggestions count optional in a section result', () => {
    expect(ImportSectionResultSchema.parse(section)).toEqual(section)
    expect(
      ImportSectionResultSchema.parse({ ...section, suggestions: 2 })
    ).toEqual({
      ...section,
      suggestions: 2
    })
  })

  it('wraps any result in the same job status envelope', () => {
    const schema = importStatusResponseSchema(ImportSectionResultSchema)

    expect(schema.parse({ status: 'idle' })).toEqual({ status: 'idle' })
    expect(
      schema.parse({
        status: 'completed',
        result: section,
        finishedAt: 10,
        cooldownUntil: 20
      })
    ).toMatchObject({ status: 'completed', result: section })
    expect(schema.safeParse({ status: 'running' }).success).toBe(false)
  })

  it('shares the start and disconnect schemas between the three platforms', () => {
    expect(SteamSchema.StartImportResponseSchema).toBe(
      PsnSchema.StartImportResponseSchema
    )
    expect(PsnSchema.StartImportResponseSchema).toBe(
      XboxSchema.StartImportResponseSchema
    )
    expect(SteamSchema.DisconnectResponseSchema).toBe(
      XboxSchema.DisconnectResponseSchema
    )
  })

  it('keeps each platform result shape', () => {
    expect(
      SteamSchema.ImportStatusResponseSchema.safeParse({
        status: 'completed',
        result: { library: section, wishlist: section }
      }).success
    ).toBe(true)
    expect(
      SteamSchema.ImportStatusResponseSchema.safeParse({
        status: 'completed',
        result: { library: section }
      }).success
    ).toBe(false)
    expect(
      PsnSchema.ImportStatusResponseSchema.safeParse({
        status: 'completed',
        result: { library: section }
      }).success
    ).toBe(true)
    expect(
      XboxSchema.ImportStatusResponseSchema.safeParse({
        status: 'completed',
        result: {
          library: section,
          accounts: [{ gamertag: 'tag', library: section, warning: 'w' }]
        }
      }).success
    ).toBe(true)
  })
})
