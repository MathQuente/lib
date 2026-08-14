import fastify, { FastifyInstance } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import { redis } from './database/redis'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'
import { Jwt } from './jwt'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { gameRoutes } from './routes/game'
import { ratingRoutes } from './routes/rating'
import { errorHandler } from './error-handler'
import { userGameStatusRoutes } from './routes/userGameStatus'
import fastifyOauth2, { FastifyOAuth2Options } from '@fastify/oauth2'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }
}

export class Server {
  private static app: FastifyInstance = fastify()
  private static port: number = Number(process.env.PORT) || 3333
  private static host: string = '0.0.0.0'

  private static getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
      throw new Error(`${name} environment variable is required`)
    }
    return value
  }

  public static async start() {
    this.setupZodTypeProvider()
    this.initErrorHandler()

    Jwt.initSetup(this.app)

    await this.initOAuth2()
    await this.initRateLimit()
    this.initRoutes()

    await this.app.listen({
      port: Server.port,
      host: Server.host
    })
    console.log(`🚀 Server running on http://${Server.host}:${Server.port}`)
  }

  private static setupZodTypeProvider() {
    this.app.setValidatorCompiler(validatorCompiler)
    this.app.setSerializerCompiler(serializerCompiler)
  }

  private static async initOAuth2() {
    const googleOAuth2Options: FastifyOAuth2Options = {
      name: 'googleOAuth2',
      credentials: {
        client: {
          id: this.getRequiredEnv('GOOGLE_CLIENT_ID'),
          secret: this.getRequiredEnv('GOOGLE_CLIENT_SECRET')
        },
        auth: fastifyOauth2.GOOGLE_CONFIGURATION
      },
      callbackUri: this.getRequiredEnv('GOOGLE_OAUTH_CALLBACK_URL'),
      scope: ['openid', 'email', 'profile']
    }

    await this.app.register(fastifyOauth2, googleOAuth2Options)

    const discordOAuth2Options: FastifyOAuth2Options = {
      name: 'discordOAuth2',
      credentials: {
        client: {
          id: this.getRequiredEnv('DISCORD_CLIENT_ID'),
          secret: this.getRequiredEnv('DISCORD_CLIENT_SECRET')
        },
        auth: {
          authorizeHost: 'https://discord.com',
          authorizePath: '/api/oauth2/authorize',
          tokenHost: 'https://discord.com',
          tokenPath: '/api/oauth2/token'
        }
      },
      callbackUri: this.getRequiredEnv('DISCORD_OAUTH_CALLBACK_URL'),
      scope: ['identify', 'email']
    }

    await this.app.register(fastifyOauth2, discordOAuth2Options)
  }

  private static initRoutes() {
    this.app.register(authRoutes, { prefix: '/auth' })
    this.app.register(userRoutes, { prefix: '/users' })
    this.app.register(gameRoutes, { prefix: '/games' })
    this.app.register(ratingRoutes, { prefix: '/rating' })
    this.app.register(userGameStatusRoutes, { prefix: '/status' })
  }

  private static async initRateLimit() {
    await this.app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      redis,
      nameSpace: 'rate-limit'
    })
  }

  private static initErrorHandler() {
    this.app.setErrorHandler(errorHandler)
  }
}
