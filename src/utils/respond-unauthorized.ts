import type { FastifyReply } from 'fastify'
import { sendProblem } from './problem'

export function respondUnauthorized(response: FastifyReply) {
  return sendProblem(response, 401, {
    status: 'unauthorized',
    message: 'Sessão inválida ou expirada.'
  })
}
