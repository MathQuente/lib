import { describe, it, expect, vi, afterEach } from 'vitest'
import { SteamApiError, SteamApiService } from './steam-api.service'

const RETURN_TO =
  'https://lib.example/api/users/steam/openid/callback?state=abc'
const CLAIMED_ID = 'https://steamcommunity.com/openid/id/76561197960287930'

function assertion(overrides: Record<string, string> = {}) {
  return {
    state: 'abc',
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': CLAIMED_ID,
    'openid.identity': CLAIMED_ID,
    'openid.return_to': RETURN_TO,
    'openid.response_nonce': '2026-10-05T00:00:00Zabc',
    'openid.assoc_handle': '1234567890',
    'openid.signed':
      'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'c2ln',
    ...overrides
  }
}

function mockSteamAnswer(body: string, ok = true) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok, text: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SteamApiService.buildOpenIdLoginUrl', () => {
  it('asks Steam to send the user back to the return URL', () => {
    const url = new URL(SteamApiService.buildOpenIdLoginUrl(RETURN_TO))

    expect(url.origin + url.pathname).toBe(
      'https://steamcommunity.com/openid/login'
    )
    expect(url.searchParams.get('openid.return_to')).toBe(RETURN_TO)
    expect(url.searchParams.get('openid.realm')).toBe('https://lib.example')
  })
})

describe('SteamApiService.verifyOpenIdAssertion', () => {
  it('returns the SteamID64 when Steam confirms the assertion', async () => {
    const fetchMock = mockSteamAnswer(
      'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'
    )

    const steamId = await SteamApiService.verifyOpenIdAssertion(
      assertion(),
      RETURN_TO
    )

    expect(steamId).toBe('76561197960287930')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://steamcommunity.com/openid/login')
    expect(init.body.get('openid.mode')).toBe('check_authentication')
    expect(init.body.get('openid.sig')).toBe('c2ln')
    expect(init.body.has('state')).toBe(false)
  })

  it('returns null when Steam says the assertion is invalid', async () => {
    mockSteamAnswer('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n')

    expect(
      await SteamApiService.verifyOpenIdAssertion(assertion(), RETURN_TO)
    ).toBeNull()
  })

  it.each([
    ['a cancelled login', { 'openid.mode': 'cancel' }],
    [
      'another OpenID provider',
      { 'openid.op_endpoint': 'https://evil.example/openid' }
    ],
    ['a return_to from another flow', { 'openid.return_to': RETURN_TO + 'x' }],
    [
      'a claimed_id outside steamcommunity.com',
      {
        'openid.claimed_id': 'https://evil.example/openid/id/76561197960287930',
        'openid.identity': 'https://evil.example/openid/id/76561197960287930'
      }
    ],
    [
      'an unsigned claimed_id',
      { 'openid.signed': 'signed,op_endpoint,return_to' }
    ]
  ])('rejects %s without asking Steam', async (_name, overrides) => {
    const fetchMock = mockSteamAnswer('is_valid:true\n')

    expect(
      await SteamApiService.verifyOpenIdAssertion(
        assertion(overrides),
        RETURN_TO
      )
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('SteamApiService.getPersonaName', () => {
  function mockSummaries(body: unknown, ok = true) {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok, json: () => Promise.resolve(body) })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('returns the public profile name', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    const fetchMock = mockSummaries({
      response: { players: [{ personaname: 'Matheus' }] }
    })

    const name = await SteamApiService.getPersonaName('76561197960287930')

    expect(name).toBe('Matheus')
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'steamids=76561197960287930'
    )
  })

  it('returns null when Steam finds no player', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    mockSummaries({ response: { players: [] } })

    expect(await SteamApiService.getPersonaName('1')).toBeNull()
  })

  it('returns null when Steam answers with an error status', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    mockSummaries({}, false)

    expect(await SteamApiService.getPersonaName('1')).toBeNull()
  })
})

describe('SteamApiService achievement requests', () => {
  const achievementsBody = {
    playerstats: {
      success: true,
      achievements: [{ apiname: 'A', achieved: 1, unlocktime: 5 }]
    }
  }

  function answer(status: number, body: unknown = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    }
  }

  async function run(promise: Promise<unknown>) {
    await vi.advanceTimersByTimeAsync(2_000)
    return promise
  }

  it('retries after a 429 and returns the data once Steam answers', async () => {
    vi.useFakeTimers()
    vi.stubEnv('STEAM_API_KEY', 'key')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(answer(429))
      .mockResolvedValueOnce(answer(200, achievementsBody))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(SteamApiService.getPlayerAchievements('1', 10))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ achieved: 1, total: 1 })
    vi.useRealTimers()
  })

  it('retries after a network error', async () => {
    vi.useFakeTimers()
    vi.stubEnv('STEAM_API_KEY', 'key')
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(answer(200, achievementsBody))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(SteamApiService.getPlayerAchievements('1', 10))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ achieved: 1 })
    vi.useRealTimers()
  })

  it('does not retry a 403 (private profile)', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    const fetchMock = vi.fn().mockResolvedValue(answer(403))
    vi.stubGlobal('fetch', fetchMock)

    const result = await SteamApiService.getPlayerAchievements('1', 10)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  it('gives up after two retries', async () => {
    vi.useFakeTimers()
    vi.stubEnv('STEAM_API_KEY', 'key')
    const fetchMock = vi.fn().mockResolvedValue(answer(503))
    vi.stubGlobal('fetch', fetchMock)

    const result = await run(SteamApiService.getAchievementSchema(10))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result).toBeNull()
    vi.useRealTimers()
  })
})

describe('SteamApiService.getOwnedGames', () => {
  function answer(status: number, body: unknown = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    }
  }

  it('returns the games of a public profile', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    const games = [{ appid: 1, name: 'A', playtime_forever: 10 }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(200, { response: { games } })))

    expect(await SteamApiService.getOwnedGames('1')).toEqual(games)
  })

  it('returns null when the profile is private (200 without games)', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(200, { response: {} })))

    expect(await SteamApiService.getOwnedGames('1')).toBeNull()
  })

  it.each([401, 403, 429, 500, 503])(
    'throws a SteamApiError carrying status %i',
    async status => {
      vi.stubEnv('STEAM_API_KEY', 'key')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(status)))

      await expect(SteamApiService.getOwnedGames('1')).rejects.toMatchObject({
        name: 'SteamApiError',
        status
      })
    }
  )

  it('throws a SteamApiError without status when the request fails', async () => {
    vi.stubEnv('STEAM_API_KEY', 'key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')))

    const error = await SteamApiService.getOwnedGames('1').catch(e => e)

    expect(error).toBeInstanceOf(SteamApiError)
    expect(error.status).toBeUndefined()
  })
})
