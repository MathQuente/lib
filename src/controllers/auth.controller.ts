import { FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from '../services/auth.service'
import * as UserSchema from '../schemas/user.schema'
import { ClientError } from '../errors/client-error'

export class AuthController {
  constructor(private authService: AuthService) {}

  // Shared by createUser/loginHandler/googleCallback/discordCallback — same
  // session-establishing rule everywhere, not per-provider behavior. Kept
  // separate from refreshTokenHandler, which sets refreshToken with the
  // token's real `expires` instead of a rolling maxAge.
  private setAuthCookies(
    reply: FastifyReply,
    accessToken: string,
    refreshToken: string
  ) {
    return reply
      .setCookie('accessToken', accessToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15
      })
      .setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      })
  }

  private redirectWithOAuthError(
    reply: FastifyReply,
    provider: string,
    error: unknown
  ) {
    console.error(`${provider} OAuth Error:`, error)
    return reply.redirect(process.env.FRONTEND_URL + '/auth?error=oauth_failed')
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const data = UserSchema.UserBodySchema.parse(request.body)

    const { accessToken, refreshToken, user } =
      await this.authService.createUser(data)

    this.setAuthCookies(reply, accessToken, refreshToken).send({ user })
  }

  async loginHandler(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = UserSchema.UserBodySchema.parse(request.body)

    const { user } = await this.authService.validateUser(email, password)

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user.id
    )

    this.setAuthCookies(reply, accessToken, refreshToken).send({ user })
  }

  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken

    if (!refreshToken) throw new ClientError('Refresh token not provided', 401)

    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt
    } = await this.authService.refreshTokens(refreshToken)

    reply
      .setCookie('accessToken', accessToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15
      })
      .setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt
      })
      .send({ message: 'Tokens atualizados' })
  }

  async logoutHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken
    const accessToken = request.cookies.accessToken

    if (!refreshToken) {
      return reply.status(400).send({ message: 'Refresh token is missing' })
    }

    await this.authService.logout(refreshToken, accessToken)

    reply
      .clearCookie('accessToken')
      .clearCookie('refreshToken')
      .send({ message: 'Logged out successfully' })
  }

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { code } = request.query as { code: string; state: string }

      if (!code) {
        throw new ClientError('Authorization code missing', 400)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oauth2 = (request.server as any).googleOAuth2

      const tokenResponse = await oauth2
        .getNewAccessTokenUsingRefreshToken(oauth2.accessToken, {
          code,
          redirect_uri: process.env.GOOGLE_OAUTH_CALLBACK_URL!,
          grant_type: 'authorization_code'
        })
        .catch(async () => {
          const params = new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: process.env.GOOGLE_OAUTH_CALLBACK_URL!,
            grant_type: 'authorization_code'
          })

          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
          })

          if (!response.ok) {
            const error = await response.text()
            throw new ClientError(`Token exchange failed: ${error}`, 502)
          }

          return await response.json()
        })

      const accessTokenGoogle = tokenResponse.access_token

      const res = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessTokenGoogle}` } }
      )

      if (!res.ok) {
        throw new ClientError('Failed to fetch user info', 502)
      }

      const profile = (await res.json()) as {
        sub: string
        email: string
        name: string
        picture: string
      }

      const { accessToken, refreshToken } =
        await this.authService.loginWithGoogle(profile)

      this.setAuthCookies(reply, accessToken, refreshToken).redirect(
        process.env.FRONTEND_URL + '/'
      )
    } catch (error) {
      this.redirectWithOAuthError(reply, 'Google', error)
    }
  }

  async discordCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { code } = request.query as { code: string }

      if (!code) {
        throw new ClientError('Authorization code missing', 400)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oauth2 = (request.server as any).discordOAuth2

      const tokenResponse = await oauth2
        .getAccessTokenFromAuthorizationCodeFlow(request)
        .catch(async () => {
          const params = new URLSearchParams({
            code,
            client_id: process.env.DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            redirect_uri: process.env.DISCORD_OAUTH_CALLBACK_URL!,
            grant_type: 'authorization_code'
          })

          const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
          })

          if (!response.ok) {
            const error = await response.text()
            throw new ClientError(`Token exchange failed: ${error}`, 502)
          }

          return await response.json()
        })

      const accessTokenDiscord = tokenResponse.access_token

      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessTokenDiscord}` }
      })

      if (!res.ok) {
        throw new ClientError('Failed to fetch user info', 502)
      }

      const profile = (await res.json()) as {
        id: string
        email: string
        username: string
        avatar: string
      }

      const { accessToken, refreshToken } =
        await this.authService.loginWithDiscord(profile)

      this.setAuthCookies(reply, accessToken, refreshToken).redirect(
        process.env.FRONTEND_URL + '/'
      )
    } catch (error) {
      this.redirectWithOAuthError(reply, 'Discord', error)
    }
  }
}
