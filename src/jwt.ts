import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyOauth2, { FastifyOAuth2Options } from '@fastify/oauth2'

interface JwtPayload {
  userId: string
  iat?: number
  exp?: number
}

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
    this.registerOAuth2(fastify)
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
    fastify.register(fastifyCors, {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true
    })
  }

  private static authenticateDecorator = (fastify: FastifyInstance) => {
    fastify.decorate(
      'authenticate',
      async (request: FastifyRequest, response: FastifyReply) => {
        try {
          await request.jwtVerify()
        } catch (error: any) {
          if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE') {
            const refreshToken = request.cookies.refreshToken

            if (!refreshToken) {
              return response.status(401).send({ status: 'unauthorized' })
            }

            try {
              const decoded = fastify.jwt.verify(refreshToken) as JwtPayload

              const newAccessToken = fastify.jwt.sign({
                userId: decoded.userId
              })

              response.setCookie('accessToken', newAccessToken, {
                httpOnly: false,
                secure: true,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 15
              })

              request.cookies.accessToken = newAccessToken

              await request.jwtVerify()
            } catch (error) {
              console.log('Refresh Error:', error)
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
      secret: 'abcd1234',
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

  public static registerOAuth2 = async (fastify: FastifyInstance) => {
    const oauth2Options: FastifyOAuth2Options = {
      name: 'googleOAuth2',
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID!,
          secret: process.env.GOOGLE_CLIENT_SECRET!
        },
        auth: fastifyOauth2.GOOGLE_CONFIGURATION
      },
      callbackUri: 'http://localhost:3333/auth/google/callback',
      scope: ['openid', 'email', 'profile']
    }

    await fastify.register(fastifyOauth2, oauth2Options)
  }
}
