import { describe, it, expect, vi } from 'vitest'
import fastify from 'fastify'
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

function buildApp(responseUserId: string = VALID_UUID) {
  const app = fastify()
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

describe('validação HTTP com os schemas reais', () => {
  it('normaliza o e-mail do cadastro (trim, minúsculas)', async () => {
    const response = await buildApp().inject({
      method: 'POST',
      url: '/register',
      payload: { ...validRegister, email: '  Ana@Mail.COM ' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ email: 'ana@mail.com' })
  })

  it.each([
    ['sem aceitar os termos', { ...validRegister, acceptedTerms: false }],
    [
      'com acceptedTerms ausente',
      { email: validRegister.email, password: validRegister.password }
    ],
    ['com e-mail inválido', { ...validRegister, email: 'sem-arroba' }],
    ['com senha comum', { ...validRegister, password: 'Password123' }]
  ])(
    'recusa o cadastro %s com 400 e sem detalhar o erro',
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

  it('devolve as mensagens por campo quando o controller faz o parse (rotas de auth)', async () => {
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

  it('mantém as mensagens próprias do schema de cadastro', () => {
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

  it('aplica coerção, padrão e catch na query de /games', async () => {
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
    'recusa a query de /games com %s',
    async query => {
      const response = await buildApp().inject({ url: `/games?${query}` })
      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ status: 400 })
    }
  )

  it('aceita um UUID v4 e recusa um id que não é UUID no parâmetro', async () => {
    const app = buildApp()

    const ok = await app.inject({ url: `/users/${VALID_UUID}` })
    expect(ok.statusCode).toBe(200)

    const bad = await app.inject({ url: '/users/nao-e-uuid' })
    expect(bad.statusCode).toBe(400)
  })

  it('a resposta passa pelo schema: remove campo extra e valida o uuid', async () => {
    const ok = await buildApp().inject({ url: '/me' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ user: { id: VALID_UUID, userName: 'ana' } })
    expect(ok.body).not.toContain('segredo')
  })

  it('uma resposta com id inválido vira 500 sem vazar o conteúdo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await buildApp('id-invalido').inject({ url: '/me' })

    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('id-invalido')
    expect(response.body).not.toContain('segredo')
  })
})
