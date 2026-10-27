import { describe, it, expect, vi } from 'vitest'
import {
  OAUTH_STATE_TTL_SECONDS,
  parseAcceptedTerms,
  readOAuthState,
  saveOAuthState
} from './oauth-state'

describe('parseAcceptedTerms', () => {
  it('accepts only the literal string "true"', () => {
    expect(parseAcceptedTerms('true')).toBe(true)
  })

  it.each([undefined, 'false', '1', 'TRUE', '', ['true'], true, 1])(
    'treats %j as not accepted',
    value => {
      expect(parseAcceptedTerms(value)).toBe(false)
    }
  )
})

describe('OAuth state storage', () => {
  it('stores an object so a refusal is still a valid state', async () => {
    const set = vi.fn().mockResolvedValue(undefined)

    await saveOAuthState({ set }, 'abc', false)

    expect(set).toHaveBeenCalledWith(
      'oauth-state:abc',
      { acceptedTerms: false },
      OAUTH_STATE_TTL_SECONDS
    )
  })

  it('reads the stored acceptance', async () => {
    const get = vi.fn().mockResolvedValue({ acceptedTerms: true })

    await expect(readOAuthState({ get }, 'abc')).resolves.toEqual({
      acceptedTerms: true
    })
    expect(get).toHaveBeenCalledWith('oauth-state:abc')
  })

  it('keeps a stored refusal as a valid state', async () => {
    const get = vi.fn().mockResolvedValue({ acceptedTerms: false })

    await expect(readOAuthState({ get }, 'abc')).resolves.toEqual({
      acceptedTerms: false
    })
  })

  it('returns null for an expired or unknown state', async () => {
    const get = vi.fn().mockResolvedValue(null)

    await expect(readOAuthState({ get }, 'abc')).resolves.toBeNull()
  })

  it('reads the legacy boolean state as not accepted', async () => {
    const get = vi.fn().mockResolvedValue(true)

    await expect(readOAuthState({ get }, 'abc')).resolves.toEqual({
      acceptedTerms: false
    })
  })
})
