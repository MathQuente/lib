import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { AuthRepository } from './repositories/auth.repository'
import { AuthService, revokedAccessTokenKey } from './services/auth.service'
import { sessionsRevokedAtKey } from './utils/session-revocation'
import { CacheRepository } from './repositories/cache.repository'
import { clearAuthCookies, setAccessTokenCookie } from './utils/auth-cookies'
import { logError, respondUnavailable } from './utils/respond-unavailable'
import { respondUnauthorized } from './utils/respond-unauthorized'

const MIN_SECRET_LENGTH = 32

const authRepository = new AuthRepository()
const cacheRepository = new CacheRepository()

const RENEWABLE_ERROR_CODES = new Set([
  'FST_JWT_NO_AUTHORIZATION_IN_COOKIE',
  'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED'
])

function findActiveRefreshUser(fastify: FastifyInstance, refreshToken: string) {
  const authService = new AuthService(
    authRepository,
    fastify.jwt,
    cacheRepository
  )
  return authService.isRefreshTokenActive(refreshToken)
}

async function issueRenewedAccessToken(
  fastify: FastifyInstance,
  request: FastifyRequest,
  response: FastifyReply,
  userId: string
) {
  const newAccessToken = fastify.jwt.sign({ userId, tokenType: 'access' })

  request.cookies.accessToken = newAccessToken

  await verifyAccessCookie(request)

  setAccessTokenCookie(response, newAccessToken)
}

function verifyAccessCookie(request: FastifyRequest) {
  return request.jwtVerify({ onlyCookie: true })
}

async function isSessionRevoked(request: FastifyRequest): Promise<boolean> {
  const accessToken = request.cookies.accessToken
  if (!accessToken) return true

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
          await verifyAccessCookie(request)

          if (request.user.tokenType === 'refresh') {
            return respondUnauthorized(response)
          }

          let revoked: boolean
          try {
            revoked = await isSessionRevoked(request)
          } catch (revocationCheckError) {
            return respondUnavailable(
              response,
              'Revocation check failed:',
              revocationCheckError
            )
          }

          if (revoked) {
            return respondUnauthorized(clearAuthCookies(response))
          }
        } catch (error) {
          const code = (error as { code?: string }).code
          if (!RENEWABLE_ERROR_CODES.has(code ?? '')) {
            return respondUnauthorized(response)
          }

          const refreshToken = request.cookies.refreshToken

          if (!refreshToken) {
            return respondUnauthorized(response)
          }

          let userId: string | null
          try {
            userId = await findActiveRefreshUser(fastify, refreshToken)
          } catch (refreshCheckError) {
            return respondUnavailable(
              response,
              'Refresh check failed:',
              refreshCheckError
            )
          }

          if (!userId) {
            return respondUnauthorized(clearAuthCookies(response))
          }

          try {
            await issueRenewedAccessToken(fastify, request, response, userId)
          } catch (renewalError) {
            return respondUnavailable(
              response,
              'Session renewal failed:',
              renewalError
            )
          }
        }
      }
    )
  }

  private static tryAuthenticateDecorator = (fastify: FastifyInstance) => {
    fastify.decorate(
      'tryAuthenticate',
      async (request: FastifyRequest, response: FastifyReply) => {
        try {
          await verifyAccessCookie(request)
        } catch (error) {
          const code = (error as { code?: string }).code
          const refreshToken = request.cookies.refreshToken

          if (RENEWABLE_ERROR_CODES.has(code ?? '') && refreshToken) {
            try {
              const userId = await findActiveRefreshUser(fastify, refreshToken)
              if (userId) {
                await issueRenewedAccessToken(
                  fastify,
                  request,
                  response,
                  userId
                )
                return
              }
            } catch (renewalError) {
              logError('Optional session renewal failed:', renewalError)
            }
            ;(request as { user?: unknown }).user = undefined
          }
          return
        }

        try {
          const isAccessToken = request.user.tokenType !== 'refresh'
          if (isAccessToken && !(await isSessionRevoked(request))) return
        } catch (revocationCheckError) {
          logError('Revocation check failed:', revocationCheckError)
        }

        ;(request as { user?: unknown }).user = undefined
      }
    )
  }

  public static registerCookiePlugin = (fastify: FastifyInstance) => {
    fastify.register(fastifyCookie, { hook: 'onRequest' })
  }
}
