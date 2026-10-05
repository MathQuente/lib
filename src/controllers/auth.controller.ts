import { FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from '../services/auth.service'
import * as AuthSchema from '../schemas/auth.schema'
import { ClientError } from '../errors/client-error'

export class AuthController {
  constructor(private authService: AuthService) {}

  private setAuthCookies(
    reply: FastifyReply,
    accessToken: string,
    refreshToken: string
  ) {
    return reply
      .setCookie('accessToken', accessToken, {
        httpOnly: true,
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
    console.error(`${provider} OAuth Error:`, {
      error: error instanceof Error ? error.message : 'unknown error'
    })
    const code =
      error instanceof ClientError && error.statusCode === 403
        ? 'email_not_verified'
        : 'oauth_failed'
    return reply.redirect(process.env.FRONTEND_URL + '/auth?error=' + code)
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const data = AuthSchema.RegisterBodySchema.parse(request.body)

    const { accessToken, refreshToken, user } =
      await this.authService.createUser(data)

    this.setAuthCookies(reply, accessToken, refreshToken).send({ user })
  }

  async loginHandler(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = AuthSchema.LoginBodySchema.parse(request.body)

    const { user } = await this.authService.validateUser(email, password)

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user.id
    )

    this.setAuthCookies(reply, accessToken, refreshToken).send({ user })
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email } = AuthSchema.ForgotPasswordBodySchema.parse(request.body)

    await this.authService.requestPasswordReset(email)

    return reply.status(200).send({
      message:
        'Se existir uma conta com esse email, um link de redefinição foi enviado.'
    })
  }

  async validateResetToken(request: FastifyRequest, reply: FastifyReply) {
    const { token } = AuthSchema.ResetTokenBodySchema.parse(request.body)

    const valid = await this.authService.isPasswordResetTokenValid(token)

    return reply.status(200).send({ valid })
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, password } = AuthSchema.ResetPasswordBodySchema.parse(
      request.body
    )

    await this.authService.resetPassword(token, password)

    return reply.status(200).send({ message: 'Senha atualizada com sucesso.' })
  }

  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken

    if (!refreshToken) throw new ClientError('Token de atualização não enviado.', 401)

    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt
    } = await this.authService.refreshTokens(refreshToken)

    reply
      .setCookie('accessToken', accessToken, {
        httpOnly: true,
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

    if (refreshToken || accessToken) {
      await this.authService.logout(refreshToken, accessToken)
    }

    reply
      .clearCookie('accessToken', { path: '/' })
      .clearCookie('refreshToken', { path: '/' })
      .send({ message: 'Sessão encerrada com sucesso.' })
  }

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { code } = request.query as { code: string; state: string }

      if (!code) {
        throw new ClientError('Código de autorização ausente.', 400)
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
            throw new ClientError(
              `Falha na troca de token (status ${response.status})`,
              502
            )
          }

          return await response.json()
        })

      const accessTokenGoogle = tokenResponse.access_token

      const res = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessTokenGoogle}` } }
      )

      if (!res.ok) {
        throw new ClientError('Falha ao buscar informações do usuário.', 502)
      }

      const profile = (await res.json()) as {
        sub: string
        email: string
        email_verified?: boolean
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
        throw new ClientError('Código de autorização ausente.', 400)
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
            throw new ClientError(
              `Falha na troca de token (status ${response.status})`,
              502
            )
          }

          return await response.json()
        })

      const accessTokenDiscord = tokenResponse.access_token

      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessTokenDiscord}` }
      })

      if (!res.ok) {
        throw new ClientError('Falha ao buscar informações do usuário.', 502)
      }

      const profile = (await res.json()) as {
        id: string
        email: string
        verified?: boolean
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
