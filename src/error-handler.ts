import type { FastifyInstance } from 'fastify'
import { ClientError } from './errors/client-error'
import { ZodError } from 'zod'
import { IGDBRequestError } from './errors/igdb-request-error'

type FastifyErrorHandler = FastifyInstance['errorHandler']

export const errorHandler: FastifyErrorHandler = (error, request, reply) => {
  console.error(error)
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Invalid input',
      error: error.flatten().fieldErrors
    })
  }

  if (error instanceof ClientError) {
    return reply.status(error.statusCode).send({
      message: error.message
    })
  }

  if (error instanceof IGDBRequestError) {
    return reply.status(502).send({
      message: 'Upstream game data provider failed'
    })
  }

  return reply.status(500).send({ message: 'Internal server error' })
}
