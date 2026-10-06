import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSeedPassword } from './seed-password'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('getSeedPassword', () => {
  it('uses SEED_USER_PASSWORD when it is set', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SEED_USER_PASSWORD', 'a-seed-password')

    expect(getSeedPassword()).toBe('a-seed-password')
  })

  it('generates and prints a random password when none is set', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SEED_USER_PASSWORD', '')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const first = getSeedPassword()
    const second = getSeedPassword()

    expect(first.length).toBeGreaterThanOrEqual(16)
    expect(first).not.toBe(second)
    expect(log.mock.calls[0][0]).toContain(first)
  })

  it('rejects a short SEED_USER_PASSWORD', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SEED_USER_PASSWORD', '123456')

    expect(() => getSeedPassword()).toThrow(/at least 8/)
  })

  it('refuses to run in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SEED_USER_PASSWORD', 'a-seed-password')

    expect(() => getSeedPassword()).toThrow(/production/)
  })
})
