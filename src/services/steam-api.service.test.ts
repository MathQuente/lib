import { describe, it, expect, vi, afterEach } from 'vitest'
import { SteamApiService } from './steam-api.service'

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
