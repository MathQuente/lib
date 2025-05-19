import { FastifyRequest } from 'fastify'

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string
    [key: string]: any
  }
}
