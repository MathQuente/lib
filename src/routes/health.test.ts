import fastify from 'fastify'
import { describe, it, expect } from 'vitest'
import { healthRoutes, type HealthChecks } from './health'

async function buildApp(checks: HealthChecks, timeoutMs = 50) {
  const app = fastify()
  await app.register(healthRoutes, { checks, timeoutMs })
  return app
}

const healthy: HealthChecks = {
  database: async () => 1,
  redis: async () => 'PONG'
}

describe('GET /health', () => {
  it('answers 200 without touching any dependency', async () => {
    const app = await buildApp({
      database: async () => {
        throw new Error('database down')
      },
      redis: async () => {
        throw new Error('redis down')
      }
    })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /ready', () => {
  it('answers 200 when the database and redis respond', async () => {
    const app = await buildApp(healthy)

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready' })
  })

  it('answers 503 when the database fails, without leaking the cause', async () => {
    const app = await buildApp({
      ...healthy,
      database: async () => {
        throw new Error('password authentication failed for user "lib"')
      }
    })

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable' })
    expect(response.body).not.toContain('password')
  })

  it('answers 503 when redis fails', async () => {
    const app = await buildApp({
      ...healthy,
      redis: async () => {
        throw new Error('ECONNREFUSED')
      }
    })

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
  })

  it('answers 503 when a check throws before returning a promise', async () => {
    const app = await buildApp({
      ...healthy,
      database: () => {
        throw new Error('driver not initialised')
      }
    })

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
  })

  it('answers 503 when a dependency does not answer in time', async () => {
    const app = await buildApp({
      ...healthy,
      redis: () => new Promise(() => {})
    })

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
  })
})
