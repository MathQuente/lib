import type { FastifyReply } from 'fastify'
import { sendProblem } from './problem'

export const RETRY_AFTER_SECONDS = 5

export function logError(label: string, error: unknown) {
  console.error(label, {
    error: error instanceof Error ? error.message : 'unknown error'
  })
}

export function respondUnavailable(
  response: FastifyReply,
  label: string,
  error: unknown
) {
  logError(label, error)
  return sendProblem(
    response.header('Retry-After', String(RETRY_AFTER_SECONDS)),
    503,
    {
      status: 'unavailable',
      message: 'Serviço indisponível no momento. Tente novamente em instantes.'
    }
  )
}
