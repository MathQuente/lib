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

    return reply.send({ accessToken, refreshToken, user })
  }

  async loginHandler(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = UserSchema.UserBodySchema.parse(request.body)

    const user = await this.authService.validateUser(email, password)

    const tokens = await this.authService.generateTokens(user.id)

    return reply.send(tokens)
  }

  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization
    if (!authHeader) throw new ClientError('No token provided')
    const [, token] = authHeader.split(' ')
    if (!token)
      return reply.status(401).send({ message: 'Refresh token not provided' })

    const { accessToken, refreshToken, expiresAt } =
      await this.authService.refreshTokens(token)

    return reply.send({ accessToken, refreshToken })
  }

  async logoutHandler(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken
    await this.authService.logout(refreshToken)

    reply.clearCookie('refreshToken', {
      path: '/refresh',
      secure: true,
      httpOnly: true,
      sameSite: true
    })

    return reply.send({ message: 'Logged out successfully' })
  }
}
