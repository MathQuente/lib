import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { AuthRepository } from './repositories/auth.repository'
import {
  AuthService,
  revokedAccessTokenKey,
  sessionsRevokedAtKey
} from './services/auth.service'
import { CacheRepository } from './repositories/cache.repository'
import { clearAuthCookies, setAccessTokenCookie } from './utils/auth-cookies'

const MIN_SECRET_LENGTH = 32

const authRepository = new AuthRepository()
const cacheRepository = new CacheRepository()

async function isSessionRevoked(request: FastifyRequest): Promise<boolean> {
  const accessToken = request.cookies.accessToken
  if (!accessToken) return false

  const revokedToken = await cacheRepository.get(
    revokedAccessTokenKey(accessToken)
  )
  if (revokedToken !== null) return true

  const { userId, iat } = request.user as { userId: string; iat?: number }
  const revokedAt = await cacheRepository.get(sessionsRevokedAtKey(userId))
  return typeof revokedAt === 'number' && (iat ?? 0) < revokedAt
}

export class Jwt {
  private static getSecret(): string {
    const secret = process.env.SECRET_JWT_KEY
    if (!secret) {
      throw new Error('SECRET_JWT_KEY environment variable is required')
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SECRET_JWT_KEY must have at least ${MIN_SECRET_LENGTH} characters`
      )
    }
    return secret
  }

  public static initSetup(fastify: FastifyInstance) {
    this.registerJwtPlugin(fastify)
    this.registerCookiePlugin(fastify)
    this.authenticateDecorator(fastify)
    this.tryAuthenticateDecorator(fastify)
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
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  }

  private static authenticateDecorator = (fastify: FastifyInstance) => {
    fastify.decorate(
      'authenticate',
      async (request: FastifyRequest, response: FastifyReply) => {
        try {
          await request.jwtVerify()

          if (request.user.tokenType === 'refresh') {
            return response.status(401).send({ status: 'unauthorized' })
          }

          let revoked: boolean
          try {
            revoked = await isSessionRevoked(request)
          } catch (revocationCheckError) {
            console.error('Revocation check failed:', {
              error:
                revocationCheckError instanceof Error
                  ? revocationCheckError.message
                  : 'unknown error'
            })
            return response.status(503).send({ status: 'unavailable' })
          }

          if (revoked) {
            return clearAuthCookies(response)
              .status(401)
              .send({ status: 'unauthorized' })
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
                return clearAuthCookies(response)
                  .status(401)
                  .send({ status: 'unauthorized' })
              }

              const newAccessToken = fastify.jwt.sign({
                userId,
                tokenType: 'access'
              })

              setAccessTokenCookie(response, newAccessToken)

              request.cookies.accessToken = newAccessToken

              await request.jwtVerify()
            } catch (error) {
              console.error('Refresh Error:', {
                error: error instanceof Error ? error.message : 'unknown error'
              })
              return clearAuthCookies(response)
                .status(401)
                .send({ status: 'unauthorized' })
            }
          } else {
            return response.status(401).send({ status: 'unauthorized' })
          }
        }
      }
    )
  }

  private static tryAuthenticateDecorator = (fastify: FastifyInstance) => {
    fastify.decorate('tryAuthenticate', async (request: FastifyRequest) => {
      try {
        await request.jwtVerify()
      } catch {
        // anonymous — proceed without request.user
        return
      }

      try {
        const isAccessToken = request.user.tokenType !== 'refresh'
        if (isAccessToken && !(await isSessionRevoked(request))) return
      } catch {}

      ;(request as { user?: unknown }).user = undefined
    })
  }

  public static registerCookiePlugin = (fastify: FastifyInstance) => {
    fastify.register(fastifyCookie, { hook: 'onRequest' })
  }
}
