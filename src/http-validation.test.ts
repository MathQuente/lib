import { afterEach, describe, it, expect, vi } from 'vitest'
import fastify, { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { errorHandler } from './error-handler'
import { ErrorSchemas } from './schemas/error.schema'
import { RegisterBodySchema, LoginBodySchema } from './schemas/auth.schema'
import { GameQueryStringSchema } from './schemas/game.schema'
import {
  DeleteUserResponseSchema,
  UserParamsSchema
} from './schemas/user.schema'

const VALID_UUID = '7382946c-eee7-46bf-9788-b5613cf0d711'

const apps: FastifyInstance[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(apps.splice(0).map(app => app.close()))
})

function buildApp(responseUserId: string = VALID_UUID) {
  const app = fastify()
  apps.push(app)
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.post(
    '/register',
    { schema: { body: RegisterBodySchema } },
    async request => ({ email: request.body.email })
  )
  typed.post(
    '/login',
    { schema: { body: LoginBodySchema } },
    async request => ({
      email: request.body.email
    })
  )
  app.post('/register-parse', async request => ({
    email: RegisterBodySchema.parse(request.body).email
  }))
  typed.get(
    '/games',
    { schema: { querystring: GameQueryStringSchema } },
    async request => request.query
  )
  typed.get(
    '/users/:userId',
    { schema: { params: UserParamsSchema } },
    async request => ({ userId: request.params.userId })
  )
  typed.get(
    '/me',
    {
      schema: {
        response: {
          200: DeleteUserResponseSchema,
          500: ErrorSchemas.InternalServerError
        }
      }
    },
    async () => ({
      user: { id: responseUserId, userName: 'ana', leaked: 'segredo' }
    })
  )
  return app
}

const validRegister = {
  email: 'someone99@a.com',
  password: 'k3!fPq9z-correct',
  acceptedTerms: true
}

describe('HTTP validation with the real schemas', () => {
  it('normalizes the sign-up email (trim, lowercase)', async () => {
    const response = await buildApp().inject({
      method: 'POST',
      url: '/register',
      payload: { ...validRegister, email: '  Ana@Mail.COM ' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ email: 'ana@mail.com' })
  })

  it.each([
    ['without accepting the terms', { ...validRegister, acceptedTerms: false }],
    [
      'with acceptedTerms missing',
      { email: validRegister.email, password: validRegister.password }
    ],
    ['with an invalid email', { ...validRegister, email: 'sem-arroba' }],
    ['with a common password', { ...validRegister, password: 'Password123' }]
  ])(
    'rejects the sign-up %s with 400 and the generic message',
    async (_n, payload) => {
      const response = await buildApp().inject({
        method: 'POST',
        url: '/register',
        payload
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        status: 400,
        message: 'Invalid input'
      })
    }
  )

  it('returns per-field messages when the controller parses the body (auth routes)', async () => {
    const app = buildApp()
    const errorOf = async (payload: object) => {
      const response = await app.inject({
        method: 'POST',
        url: '/register-parse',
        payload
      })
      expect(response.statusCode).toBe(400)
      return response.json().error
    }

    expect(await errorOf({ ...validRegister, acceptedTerms: false })).toEqual({
      acceptedTerms: ['Confirme que tem 18 anos ou mais e aceita os Termos.']
    })
    expect(
      await errorOf({ ...validRegister, password: 'Password123' })
    ).toEqual({ password: ['Essa senha é muito comum. Escolha outra.'] })
    expect(
      Object.keys(await errorOf({ ...validRegister, email: 'x' }))
    ).toEqual(['email'])

    const ok = await app.inject({
      method: 'POST',
      url: '/register-parse',
      payload: { ...validRegister, email: '  Ana@Mail.COM ' }
    })
    expect(ok.json()).toEqual({ email: 'ana@mail.com' })
  })

  it('keeps the custom messages of the sign-up schema', () => {
    const messages = (body: object) => {
      const result = RegisterBodySchema.safeParse(body)
      return result.success ? [] : result.error.issues.map(i => i.message)
    }

    expect(messages({ ...validRegister, acceptedTerms: false })).toContain(
      'Confirme que tem 18 anos ou mais e aceita os Termos.'
    )
    expect(
      messages({ email: validRegister.email, password: validRegister.password })
    ).toContain('Confirme que tem 18 anos ou mais e aceita os Termos.')
    expect(messages({ ...validRegister, password: 'Password123' })).toContain(
      'Essa senha é muito comum. Escolha outra.'
    )
  })

  it('applies coerce, default and catch to the /games query', async () => {
    const app = buildApp()

    const defaults = await app.inject({ url: '/games' })
    expect(defaults.json()).toEqual({
      pageIndex: 0,
      limit: 20,
      sortBy: 'release_date',
      sortOrder: 'desc'
    })

    const coerced = await app.inject({
      url: '/games?pageIndex=2&limit=50&sortBy=rating&sortOrder=asc'
    })
    expect(coerced.json()).toEqual({
      pageIndex: 2,
      limit: 50,
      sortBy: 'rating',
      sortOrder: 'asc'
    })

    const caught = await app.inject({
      url: '/games?sortBy=invalido&sortOrder=tanto-faz'
    })
    expect(caught.json()).toMatchObject({
      sortBy: 'release_date',
      sortOrder: 'desc'
    })
  })

  it.each([['limit=0'], ['limit=101'], ['pageIndex=-1'], ['limit=abc']])(
    'rejects the /games query with %s',
    async query => {
      const response = await buildApp().inject({ url: `/games?${query}` })
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ status: 400 })
    }
  )

  it('accepts a UUID v4 and rejects a non-UUID id in the param', async () => {
    const app = buildApp()

    const ok = await app.inject({ url: `/users/${VALID_UUID}` })
    expect(ok.statusCode).toBe(200)

    const bad = await app.inject({ url: '/users/nao-e-uuid' })
    expect(bad.statusCode).toBe(400)
  })

  it('rejects a UUID with a non-RFC variant (stricter in zod 4)', async () => {
    const response = await buildApp().inject({
      url: '/users/7382946c-eee7-46bf-c788-b5613cf0d711'
    })

    expect(response.statusCode).toBe(400)
  })

  it('runs the response through the schema: strips extra fields and validates the uuid', async () => {
    const ok = await buildApp().inject({ url: '/me' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ user: { id: VALID_UUID, userName: 'ana' } })
    expect(ok.body).not.toContain('segredo')
  })

  it('turns a response with an invalid id into a 500 without leaking the content', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await buildApp('id-invalido').inject({ url: '/me' })

    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('id-invalido')
    expect(response.body).not.toContain('segredo')
  })
})
