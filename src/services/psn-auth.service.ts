import {
  AuthorizationPayload,
  AuthTokensResponse,
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens
} from 'psn-api'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'

const ACCESS_TOKEN_KEY = 'psn:access-token'
const REFRESH_TOKEN_KEY = 'psn:refresh-token'
const EXPIRY_MARGIN_SECONDS = 60

export class PsnAuthService {
  private pending: Promise<AuthorizationPayload> | null = null

  constructor(private cacheRepository: CacheRepository) {}

  async getAuthorization(): Promise<AuthorizationPayload> {
    const cached = (await this.cacheRepository.get(ACCESS_TOKEN_KEY)) as
      | string
      | null
    if (cached) return { accessToken: cached }

    if (!this.pending) {
      this.pending = this.renewTokens().finally(() => {
        this.pending = null
      })
    }
    return this.pending
  }

  async invalidateAccessToken() {
    await this.cacheRepository.del(ACCESS_TOKEN_KEY)
  }

  private async renewTokens(): Promise<AuthorizationPayload> {
    const refreshToken = (await this.cacheRepository.get(
      REFRESH_TOKEN_KEY
    )) as string | null

    if (refreshToken) {
      try {
        const tokens = await exchangeRefreshTokenForAuthTokens(refreshToken)
        return await this.storeTokens(tokens)
      } catch (err) {
        console.warn('[PsnAuth] refresh token exchange failed, falling back to NPSSO', {
          error: err instanceof Error ? err.message : err
        })
      }
    }

    try {
      const npsso = process.env.PSN_NPSSO
      if (!npsso) throw new Error('PSN_NPSSO environment variable is required')

      const accessCode = await exchangeNpssoForAccessCode(npsso)
      const tokens = await exchangeAccessCodeForAuthTokens(accessCode)
      return await this.storeTokens(tokens)
    } catch (err) {
      console.error('[PsnAuth] NPSSO exchange failed — PSN_NPSSO may be expired', {
        error: err instanceof Error ? err.message : err
      })
      throw new ClientError(
        'Integração com a PlayStation indisponível no momento. Tente novamente mais tarde.',
        503
      )
    }
  }

  private async storeTokens(
    tokens: AuthTokensResponse
  ): Promise<AuthorizationPayload> {
    await Promise.all([
      this.cacheRepository.set(
        ACCESS_TOKEN_KEY,
        tokens.accessToken,
        Math.max(tokens.expiresIn - EXPIRY_MARGIN_SECONDS, 1)
      ),
      this.cacheRepository.set(
        REFRESH_TOKEN_KEY,
        tokens.refreshToken,
        Math.max(tokens.refreshTokenExpiresIn - EXPIRY_MARGIN_SECONDS, 1)
      )
    ])
    return { accessToken: tokens.accessToken }
  }
}
