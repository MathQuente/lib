import { fetchWithTimeout } from '../utils/fetch-with-timeout'
import { XboxProfile } from './xbox-api.service'

const MICROSOFT_AUTHORIZE_URL =
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const XBOX_USER_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XBOX_XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const XBOX_SCOPE = 'XboxLive.signin'

const XERR_NO_XBOX_PROFILE = 2148916233

export class XboxAuthError extends Error {
  constructor(
    message: string,
    public readonly reason: 'not_configured' | 'no_profile' | 'failed'
  ) {
    super(message)
    this.name = 'XboxAuthError'
  }
}

interface XboxTokenResponse {
  Token?: string
  DisplayClaims?: { xui?: { uhs?: string; xid?: string; gtg?: string }[] }
}

export class XboxAuthService {
  private static getConfig() {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const callbackUrl = process.env.XBOX_OAUTH_CALLBACK_URL
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new XboxAuthError(
        'MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and XBOX_OAUTH_CALLBACK_URL are required',
        'not_configured'
      )
    }
    return { clientId, clientSecret, callbackUrl }
  }

  static buildAuthorizeUrl(state: string): string {
    const { clientId, callbackUrl } = this.getConfig()
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: callbackUrl,
      scope: XBOX_SCOPE,
      state,
      prompt: 'select_account'
    })
    return `${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`
  }

  static async getProfileFromCode(code: string): Promise<XboxProfile> {
    const microsoftToken = await this.exchangeCode(code)
    const userToken = await this.getXboxUserToken(microsoftToken)
    return this.getXboxProfile(userToken)
  }

  private static async exchangeCode(code: string): Promise<string> {
    const { clientId, clientSecret, callbackUrl } = this.getConfig()

    const response = await fetchWithTimeout(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
        scope: XBOX_SCOPE
      })
    })
    if (!response.ok) {
      throw new XboxAuthError(
        `Microsoft token exchange responded ${response.status}`,
        'failed'
      )
    }

    const body = (await response.json()) as { access_token?: string }
    if (!body.access_token) {
      throw new XboxAuthError('Microsoft returned no access token', 'failed')
    }
    return body.access_token
  }

  private static async postXbox(
    url: string,
    payload: unknown
  ): Promise<Response> {
    return fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-xbl-contract-version': '1'
      },
      body: JSON.stringify(payload)
    })
  }

  private static async getXboxUserToken(
    microsoftToken: string
  ): Promise<string> {
    const response = await this.postXbox(XBOX_USER_AUTH_URL, {
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${microsoftToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
    if (!response.ok) {
      throw new XboxAuthError(
        `Xbox user authentication responded ${response.status}`,
        'failed'
      )
    }

    const body = (await response.json()) as XboxTokenResponse
    if (!body.Token) {
      throw new XboxAuthError('Xbox returned no user token', 'failed')
    }
    return body.Token
  }

  private static async getXboxProfile(userToken: string): Promise<XboxProfile> {
    const response = await this.postXbox(XBOX_XSTS_URL, {
      Properties: { SandboxId: 'RETAIL', UserTokens: [userToken] },
      RelyingParty: 'http://xboxlive.com',
      TokenType: 'JWT'
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        XErr?: number
      } | null
      if (error?.XErr === XERR_NO_XBOX_PROFILE) {
        throw new XboxAuthError(
          'Microsoft account has no Xbox profile',
          'no_profile'
        )
      }
      throw new XboxAuthError(
        `Xbox XSTS authorization responded ${response.status}`,
        'failed'
      )
    }

    const body = (await response.json()) as XboxTokenResponse
    const claims = body.DisplayClaims?.xui?.[0]
    if (!claims?.xid || !claims.gtg) {
      throw new XboxAuthError('Xbox returned no profile claims', 'failed')
    }
    return { xuid: claims.xid, gamertag: claims.gtg }
  }
}
