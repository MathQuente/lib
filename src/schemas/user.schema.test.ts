import { describe, it, expect } from 'vitest'
import {
  QueryStringSchema,
  UpdateUserBodySchema,
  UserGameBodySchema,
  UserGamePlayedCountUpdateBodySchema
} from './user.schema'

describe('UpdateUserBodySchema', () => {
  it.each([
    ['a Cloudinary URL', 'https://res.cloudinary.com/demo/image/upload/a.png'],
    ['a Google avatar', 'https://lh3.googleusercontent.com/a/abc'],
    ['a Discord avatar', 'https://cdn.discordapp.com/avatars/1/a.png']
  ])('accepts %s as profile picture', (_name, profilePicture) => {
    expect(UpdateUserBodySchema.safeParse({ profilePicture }).success).toBe(
      true
    )
  })

  it.each([
    ['another host', 'https://evil.example/pixel.png'],
    ['plain http', 'http://res.cloudinary.com/demo/a.png'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:image/png;base64,AAAA'],
    ['a look-alike host', 'https://res.cloudinary.com.evil.example/a.png']
  ])('rejects %s as profile picture', (_name, profilePicture) => {
    expect(UpdateUserBodySchema.safeParse({ profilePicture }).success).toBe(
      false
    )
  })

  it('limits the user name length', () => {
    expect(
      UpdateUserBodySchema.safeParse({ userName: 'a'.repeat(31) }).success
    ).toBe(false)
    expect(UpdateUserBodySchema.parse({ userName: '  Ana  ' }).userName).toBe(
      'Ana'
    )
  })
})

describe('library schemas', () => {
  it('only accepts existing status ids', () => {
    expect(UserGameBodySchema.safeParse({ statusId: 3 }).success).toBe(true)
    expect(UserGameBodySchema.safeParse({ statusId: 99 }).success).toBe(false)
    expect(UserGameBodySchema.safeParse({ statusId: 1.5 }).success).toBe(false)
  })

  it('only accepts single-step played count changes', () => {
    expect(
      UserGamePlayedCountUpdateBodySchema.safeParse({ incrementValue: -1 })
        .success
    ).toBe(true)
    expect(
      UserGamePlayedCountUpdateBodySchema.safeParse({
        incrementValue: 2147483647
      }).success
    ).toBe(false)
  })

  it('rejects negative and huge page indexes', () => {
    expect(QueryStringSchema.safeParse({ pageIndex: '-1' }).success).toBe(false)
    expect(QueryStringSchema.safeParse({ pageIndex: '999999' }).success).toBe(
      false
    )
  })
})
