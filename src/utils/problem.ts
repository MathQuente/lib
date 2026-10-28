import type { FastifyReply } from 'fastify'
import { STATUS_CODES } from 'node:http'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

export function sendProblem(
  reply: FastifyReply,
  statusCode: number,
  body: { message: string } & Record<string, unknown>
) {
  const hasLegacyStatus = typeof body.status === 'string'
  return reply
    .status(statusCode)
    .type(PROBLEM_CONTENT_TYPE)
    .send({
      type: 'about:blank',
      title: STATUS_CODES[statusCode] ?? 'Error',
      detail: body.message,
      ...(hasLegacyStatus ? {} : { status: statusCode }),
      ...body
    })
}
