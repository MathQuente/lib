import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { AuthRepository } from './repositories/auth.repository'
import { AuthService } from './services/auth.service'
import { CacheRepository } from './repositories/cache.repository'

const authRepository = new AuthRepository()
const cacheRepository = new CacheRepository()

export class Jwt {
  private static getSecret(): string {
    const secret = process.env.SECRET_JWT_KEY
    if (!secret) {
      throw new Error('SECRET_JWT_KEY environment variable is required')
    }
    return secret
  }

  public static initSetup(fastify: FastifyInstance) {
    this.registerJwtPlugin(fastify)
    this.registerCookiePlugin(fastify)
    this.authenticateDecorator(fastify)
    this.registerCorsPlugin(fastify)
  }

  private static registerJwtPlugin(fastify: FastifyInstance) {
    fastify.register(fastifyJwt, {
      secret: this.getSecret(),
      sign: {
        expiresIn: '15m'
      },
      cookie: {
        cookieName: 'accessToken',
        signed: false
      }
    })
  }

  public static registerCorsPlugin = (fastify: FastifyInstance) => {
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL environment variable is required')
    }

    fastify.register(fastifyCors, {
      origin: process.env.FRONTEND_URL,
      credentials: true
    })
  }

  private static authenticateDecorator = (fastify: FastifyInstance) => {
    fastify.decorate(
      'authenticate',
      async (request: FastifyRequest, response: FastifyReply) => {
        try {
          await request.jwtVerify()

          const accessToken = request.cookies.accessToken
          if (accessToken) {
            try {
              const isRevoked = await cacheRepository.get(
                `revoked:${accessToken}`
              )
              if (isRevoked !== null) {
                return response.status(401).send({ status: 'unauthorized' })
              }
            } catch (revocationCheckError) {
              console.error('Revocation check failed:', revocationCheckError)
            }
          }
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE') {
            const refreshToken = request.cookies.refreshToken

            if (!refreshToken) {
              return response.status(401).send({ status: 'unauthorized' })
            }

            try {
              const authService = new AuthService(
                authRepository,
                fastify.jwt,
                cacheRepository
              )
              const userId =
                await authService.isRefreshTokenActive(refreshToken)

              if (!userId) {
                throw new Error('Refresh token is not active')
              }

              const newAccessToken = fastify.jwt.sign({ userId })

              response.setCookie('accessToken', newAccessToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 15
              })

              request.cookies.accessToken = newAccessToken

              await request.jwtVerify()
            } catch (error) {
              console.error('Refresh Error:', error)
              response.clearCookie('accessToken')
              response.clearCookie('refreshToken')
              return response.status(401).send({ status: 'unauthorized' })
            }
          } else {
            return response.status(401).send({ status: 'unauthorized' })
          }
        }
      }
    )
  }

  public static registerCookiePlugin = (fastify: FastifyInstance) => {
    fastify.register(fastifyCookie, {
      hook: 'onRequest',
      parseOptions: {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24,
        secure: true,
        sameSite: 'none',
        signed: false
      }
    })
  }
}
