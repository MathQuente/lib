import '@fastify/jwt'
import { FastifyReply, FastifyRequest } from 'fastify'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      email?: string
      name?: string
    }
    user: {
      userId: string
      email?: string
      name?: string
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }
}
