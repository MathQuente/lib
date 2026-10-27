import { describe, it, expect } from 'vitest'
import { GetRatingsResponseSchema } from './rating.schema'

describe('GetRatingsResponseSchema', () => {
  const rating = (userName: string | null) => ({
    ratings: [
      {
        user: {
          id: '3f2b8c1e-6d4a-4a39-9c1e-0b1c2d3e4f5a',
          userName,
          profilePicture: null
        },
        value: 4
      }
    ]
  })

  it('accepts a user without a name', () => {
    expect(GetRatingsResponseSchema.safeParse(rating(null)).success).toBe(true)
  })

  it('accepts a user with a name', () => {
    expect(GetRatingsResponseSchema.safeParse(rating('ana')).success).toBe(true)
  })
})
