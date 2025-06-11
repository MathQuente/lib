import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
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

    Jwt.initSetup(this.app)
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

  private static initRoutes() {
    this.app.register(authRoutes, { prefix: '/auth' })
    this.app.register(userRoutes, { prefix: '/users' })
    this.app.register(gameRoutes, { prefix: '/games' })
    this.app.register(gameStudioRoutes, { prefix: '/gameStudio' })
    this.app.register(ratingRoutes, { prefix: '/rating' })
    this.app.register(platformsRoutes, { prefix: '/platform' })
  }
}
