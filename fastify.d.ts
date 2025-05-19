// src/types/jwt.d.ts
import '@fastify/jwt'

type UserPayload = {
  id: string
  [key: string]: any
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: import('@fastify/jwt').FastifyJWT['user']
  }
}
