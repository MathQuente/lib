import type { FastifyInstance } from 'fastify'
import { withTimeout } from '../utils/with-timeout'

export type HealthChecks = {
  database: () => Promise<unknown>
  redis: () => Promise<unknown>
}

type HealthOptions = {
  checks: HealthChecks
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 2000

function runCheck(check: () => Promise<unknown>, timeoutMs: number) {
  return withTimeout(Promise.resolve().then(check), timeoutMs, 'timeout')
}

export async function healthRoutes(
  app: FastifyInstance,
  { checks, timeoutMs = DEFAULT_TIMEOUT_MS }: HealthOptions
) {
  const config = { rateLimit: false as const }

  app.get('/health', { config }, async () => ({ status: 'ok' }))

  app.get('/ready', { config }, async (_request, reply) => {
    const results = await Promise.allSettled([
      runCheck(checks.database, timeoutMs),
      runCheck(checks.redis, timeoutMs)
    ])

    const failed = results.find(result => result.status === 'rejected')
    if (failed) {
      console.error('Readiness failed:', {
        error:
          failed.reason instanceof Error ? failed.reason.message : 'unknown'
      })
      return reply.status(503).send({ status: 'unavailable' })
    }

    return { status: 'ready' }
  })
}
