import type { FastifyError, FastifyInstance } from 'fastify'
import { ClientError } from './errors/client-error'
import { ZodError } from 'zod'
import { IGDBRequestError } from './errors/igdb-request-error'

type FastifyErrorHandler = FastifyInstance['errorHandler']

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  413: 'Payload too large',
  415: 'Unsupported media type',
  429: 'Too many requests'
}

export const errorHandler: FastifyErrorHandler = (error, request, reply) => {
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

  const fastifyError = error as FastifyError
  if (
    typeof fastifyError.statusCode === 'number' &&
    fastifyError.statusCode < 500
  ) {
    console.warn('[RequestError]', {
      method: request.method,
      url: request.url.split('?')[0],
      statusCode: fastifyError.statusCode,
      message: fastifyError.message
    })
    return reply.status(fastifyError.statusCode).send({
      message: fastifyError.validation
        ? 'Invalid input'
        : (CLIENT_ERROR_MESSAGES[fastifyError.statusCode] ?? 'Bad request')
    })
  }

  console.error('[UnhandledError]', error)
  return reply.status(500).send({ message: 'Internal server error' })
}
