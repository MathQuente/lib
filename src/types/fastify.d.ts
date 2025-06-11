import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      email: string
      name?: string
    }
    user: {
      userId: string
      email: string
      name?: string
    }
  }
}
