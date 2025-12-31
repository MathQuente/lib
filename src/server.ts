import fastify, { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'
import { Jwt } from './jwt'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { gameRoutes } from './routes/game'
import { gameStudioRoutes } from './routes/gameStudios'
import { ratingRoutes } from './routes/rating'
import { platformsRoutes } from './routes/platforms'
import { errorHandler } from './error-handler'
import { gameLaunchersRoutes } from './routes/gameLaunchers'
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
  private static port: number = 3333
  private static host: string = '0.0.0.0'

  public static async start() {
    this.setupZodTypeProvider()
    this.initErrrHandler()

    Jwt.initSetup(this.app)

    await this.initOAuth2()
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
          id: process.env.GOOGLE_CLIENT_ID!,
          secret: process.env.GOOGLE_CLIENT_SECRET!
        },
        auth: fastifyOauth2.GOOGLE_CONFIGURATION
      },
      callbackUri: 'http://localhost:3333/auth/google/callback',
      scope: ['openid', 'email', 'profile']
    }

    await this.app.register(fastifyOauth2, googleOAuth2Options)

    const discord0Auth2Options: FastifyOAuth2Options = {
      name: 'discordOAuth2',
      credentials: {
        client: {
          id: process.env.DISCORD_CLIENT_ID!,
          secret: process.env.DISCORD_CLIENT_SECRET!
        },
        auth: {
          authorizeHost: 'https://discord.com',
          authorizePath: '/api/oauth2/authorize',
          tokenHost: 'https://discord.com',
          tokenPath: '/api/oauth2/token'
        }
      },
      callbackUri: 'http://localhost:3333/auth/discord/callback',
      scope: ['identify', 'email']
    }

    await this.app.register(fastifyOauth2, discord0Auth2Options)
  }

  private static initRoutes() {
    this.app.register(authRoutes, { prefix: '/auth' })
    this.app.register(userRoutes, { prefix: '/users' })
    this.app.register(gameRoutes, { prefix: '/games' })
    this.app.register(gameStudioRoutes, { prefix: '/gameStudio' })
    this.app.register(ratingRoutes, { prefix: '/rating' })
    this.app.register(platformsRoutes, { prefix: '/platform' })
    this.app.register(gameLaunchersRoutes, { prefix: 'gameLauncher' })
    this.app.register(userGameStatusRoutes, { prefix: '/status' })
  }

  private static initErrrHandler() {
    this.app.setErrorHandler(errorHandler)
  }
}
