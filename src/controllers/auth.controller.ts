import { FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from '../services/auth.service'
import * as UserSchema from '../schemas/user.schema'
import { ClientError } from '../errors/client-error'

export class AuthController {
  constructor(private authService: AuthService) {}

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const data = UserSchema.UserBodySchema.parse(request.body)
    const { accessToken, refreshToken, user } =
      await this.authService.createUser(data)

    reply
      .setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        path: '/',
        expires: new Date(Date.now() + 60 * 60 * 1000)
      })
      .setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'none',
        path: '/',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      })
      .send({ user })
  }

  async loginHandler(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = UserSchema.UserBodySchema.parse(request.body)

    const { user } = await this.authService.validateUser(email, password)

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user.id
    )

    reply
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
      .send({ user })
  }

  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken

    if (!refreshToken) throw new ClientError('Refresh token not provided')

    const { value: jwt } = request.unsignCookie(refreshToken)

    if (!jwt) {
      return
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt
    } = await this.authService.refreshTokens(jwt)

    reply
      .setCookie('accessToken', accessToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        path: '/',
        expires: new Date(Date.now() + 60 * 60 * 1000)
      })
      .setCookie('refreshToken', newRefreshToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        path: '/',
        expires: expiresAt
      })
      .send({ message: 'Tokens atualizados' })
  }

  async logoutHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken

    if (!refreshToken) {
      return reply.status(400).send({ message: 'Refresh token is missing' })
    }

    await this.authService.logout(refreshToken)

    reply
      .clearCookie('accessToken', {
        httpOnly: true,
        secure: true,
        signed: false,
        sameSite: 'none',
        path: '/',
        expires: new Date(Date.now() + 30 * 1000)
      })
      .clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        signed: false,
        sameSite: 'none',
        path: '/',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60)
      })
      .send({ message: 'Logged out successfully' })
  }

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      const oauth2 = (request.server as any).googleOAuth2
      const tokenResponse =
        await oauth2.getAccessTokenFromAuthorizationCodeFlow(request)
      const accessTokenGoogle = tokenResponse.token.access_token

      const res = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessTokenGoogle}` } }
      )

      const profile = (await res.json()) as {
        sub: string
        email: string
        name: string
        picture: string
      }

      const { accessToken, refreshToken } =
        await this.authService.loginWithGoogle(profile)

      reply
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
        .redirect(process.env.FRONTEND_URL + '/')
    } catch (error) {
      console.error('Google OAuth Error:', error)
      reply.redirect(process.env.FRONTEND_URL + '/auth?error=oauth_failed')
    }
  }
}
