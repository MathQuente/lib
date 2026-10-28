import { describe, it, expect, vi } from 'vitest'
import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { errorHandler } from './error-handler'
import { ClientError } from './errors/client-error'
import { ErrorSchemas } from './schemas/error.schema'

function buildApp() {
  const app = fastify()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/missing',
      { schema: { response: { 404: ErrorSchemas.NotFound } } },
      async () => {
        throw new ClientError('Jogo não encontrado.', 404)
      }
    )
  app.get('/boom', async () => {
    throw new Error('secret detail')
  })
  return app
}

describe('error handler (RFC 9457, backwards compatible)', () => {
  it('keeps message and adds problem members, surviving the response schema', async () => {
    const response = await buildApp().inject({ url: '/missing' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toContain(
      'application/problem+json'
    )
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Jogo não encontrado.',
      message: 'Jogo não encontrado.'
    })
  })

  it('does not leak the cause of unexpected errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await buildApp().inject({ url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toMatchObject({
      status: 500,
      message: 'Internal server error'
    })
    expect(response.body).not.toContain('secret detail')
  })
})
