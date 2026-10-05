import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { XboxAuthError, XboxAuthService } from './xbox-auth.service'

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'client-secret')
  vi.stubEnv(
    'XBOX_OAUTH_CALLBACK_URL',
    'https://lib.example/api/users/xbox/oauth/callback'
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('XboxAuthService.buildAuthorizeUrl', () => {
  it('sends the user to the Microsoft consumer sign-in with the state', () => {
    const url = new URL(XboxAuthService.buildAuthorizeUrl('abc'))

    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
    )
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('scope')).toBe('XboxLive.signin')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://lib.example/api/users/xbox/oauth/callback'
    )
    expect(url.toString()).not.toContain('client-secret')
  })

  it('throws not_configured when the Microsoft app is not set up', () => {
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', '')

    expect(() => XboxAuthService.buildAuthorizeUrl('abc')).toThrow(
      XboxAuthError
    )
  })
})

describe('XboxAuthService.getProfileFromCode', () => {
  it('walks Microsoft -> Xbox user token -> XSTS and returns the claims', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'ms-token' }))
      .mockResolvedValueOnce(json({ Token: 'user-token' }))
      .mockResolvedValueOnce(
        json({
          Token: 'xsts-token',
          DisplayClaims: { xui: [{ uhs: 'h', xid: '2533', gtg: 'Player' }] }
        })
      )

    const profile = await XboxAuthService.getProfileFromCode('auth-code')

    expect(profile).toEqual({ xuid: '2533', gamertag: 'Player' })

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]
    expect(tokenUrl).toBe(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    )
    expect(tokenInit.body.get('code')).toBe('auth-code')
    expect(tokenInit.body.get('grant_type')).toBe('authorization_code')

    const [userUrl, userInit] = fetchMock.mock.calls[1]
    expect(userUrl).toBe('https://user.auth.xboxlive.com/user/authenticate')
    expect(JSON.parse(userInit.body).Properties.RpsTicket).toBe('d=ms-token')

    const [xstsUrl, xstsInit] = fetchMock.mock.calls[2]
    expect(xstsUrl).toBe('https://xsts.auth.xboxlive.com/xsts/authorize')
    expect(JSON.parse(xstsInit.body).Properties.UserTokens).toEqual([
      'user-token'
    ])
  })

  it('reports no_profile when the Microsoft account has no Xbox profile', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'ms-token' }))
      .mockResolvedValueOnce(json({ Token: 'user-token' }))
      .mockResolvedValueOnce(json({ XErr: 2148916233 }, 401))

    await expect(
      XboxAuthService.getProfileFromCode('auth-code')
    ).rejects.toMatchObject({ reason: 'no_profile' })
  })

  it('fails without calling Xbox when Microsoft rejects the code', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400))

    const error = await XboxAuthService.getProfileFromCode('bad-code').catch(
      e => e
    )

    expect(error).toMatchObject({ reason: 'failed' })
    expect(error.message).not.toContain('client-secret')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails when XSTS answers without profile claims', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'ms-token' }))
      .mockResolvedValueOnce(json({ Token: 'user-token' }))
      .mockResolvedValueOnce(json({ Token: 'xsts-token', DisplayClaims: {} }))

    await expect(
      XboxAuthService.getProfileFromCode('auth-code')
    ).rejects.toMatchObject({ reason: 'failed' })
  })
})
