import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthController } from '../controllers/auth.controller'
import { AuthRepository } from '../repositories/auth.repository'
import { AuthService } from '../services/auth.service'
import { CacheRepository } from '../repositories/cache.repository'
import { EmailService } from '../services/email.service'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import crypto from 'crypto'
import { BASE_COOKIE_OPTIONS } from '../utils/auth-cookies'
import {
  OAUTH_STATE_TTL_SECONDS,
  oauthStateKey,
  parseAcceptedTerms,
  readOAuthState,
  saveOAuthState
} from '../utils/oauth-state'
const OAUTH_STATE_COOKIE = 'oauth_state'

function setOAuthStateCookie(reply: FastifyReply, state: string) {
  reply.setCookie(OAUTH_STATE_COOKIE, state, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: OAUTH_STATE_TTL_SECONDS
  })
}

function matchesOAuthStateCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  state: string
): boolean {
  const cookieState = request.cookies[OAUTH_STATE_COOKIE] ?? ''
  reply.clearCookie(OAUTH_STATE_COOKIE, BASE_COOKIE_OPTIONS)

  const expected = Buffer.from(state)
  const received = Buffer.from(cookieState)
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  )
}

export async function authRoutes(app: FastifyInstance) {
  const authRepository = new AuthRepository()
  const cacheRepository = new CacheRepository()
  const emailService = new EmailService()
  const authService = new AuthService(
    authRepository,
    app.jwt,
    cacheRepository,
    emailService
  )
  const authController = new AuthController(authService)

  app.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.createUser(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.loginHandler(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.forgotPassword(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.resetPassword(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/reset-password/validate',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.validateResetToken(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/verify-email',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => authController.verifyEmail(request, reply)
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/resend-verification',
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour'
        }
      }
    },
    async (request, reply) =>
      authController.resendEmailVerification(request, reply)
  )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/refresh', async (request, reply) =>
      authController.refreshTokenHandler(request, reply)
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/logout', async (request, reply) =>
      authController.logoutHandler(request, reply)
    )

  app.get('/google', async (request, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oauth2 = (app as any).googleOAuth2

      if (!oauth2) {
        console.error('❌ OAuth2 plugin não encontrado!')
        return reply.status(500).send({ error: 'OAuth2 not configured' })
      }

      const state = crypto.randomBytes(16).toString('hex')
      await saveOAuthState(
        cacheRepository,
        state,
        parseAcceptedTerms(
          (request.query as { acceptedTerms?: unknown }).acceptedTerms
        )
      )
      setOAuthStateCookie(reply, state)

      const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: process.env.GOOGLE_OAUTH_CALLBACK_URL!,
        response_type: 'code',
        scope: 'openid email profile',
        state: state,
        access_type: 'offline',
        prompt: 'consent'
      })

      const authUrl = `${baseUrl}?${params.toString()}`

      return reply.redirect(authUrl)
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error)
      return reply.status(500).send({ error: 'Failed to start OAuth flow' })
    }
  })

  app.get('/google/callback', async (request, reply) => {
    const query = request.query as {
      state?: string
      code?: string
      error?: string
    }
    const stateFromQuery = query.state
    const code = query.code

    if (query.error) {
      console.error('❌ Erro do Google:', query.error)
      return reply.redirect(
        process.env.FRONTEND_URL +
          '/auth?error=' +
          (query.error === 'access_denied' ? 'access_denied' : 'oauth_failed')
      )
    }

    if (!stateFromQuery) {
      console.error('❌ State ausente na query')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=missing_state'
      )
    }

    if (!matchesOAuthStateCookie(request, reply, stateFromQuery)) {
      console.error('❌ State não pertence a este navegador')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=invalid_state'
      )
    }

    const cachedState = await readOAuthState(cacheRepository, stateFromQuery)
    if (!cachedState) {
      console.error('❌ State inválido ou expirado')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=invalid_state'
      )
    }

    if (!code) {
      console.error('❌ Code ausente na query')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=missing_code'
      )
    }

    await cacheRepository.del(oauthStateKey(stateFromQuery))

    return authController.googleCallback(
      request,
      reply,
      cachedState.acceptedTerms
    )
  })

  app.get('/discord', async (request, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oauth2 = (app as any).discordOAuth2

      if (!oauth2) {
        console.error('❌ OAuth2 plugin não encontrado!')
        return reply.status(500).send({ error: 'OAuth2 not configured' })
      }

      const state = crypto.randomBytes(16).toString('hex')
      await saveOAuthState(
        cacheRepository,
        state,
        parseAcceptedTerms(
          (request.query as { acceptedTerms?: unknown }).acceptedTerms
        )
      )
      setOAuthStateCookie(reply, state)

      const baseUrl = 'https://discord.com/api/oauth2/authorize'
      const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        redirect_uri: process.env.DISCORD_OAUTH_CALLBACK_URL!,
        response_type: 'code',
        scope: 'identify email',
        state: state,
        prompt: 'consent'
      })

      const authUrl = `${baseUrl}?${params.toString()}`

      return reply.redirect(authUrl)
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error)
      return reply.status(500).send({ error: 'Failed to start OAuth flow' })
    }
  })

  app.get('/discord/callback', async (request, reply) => {
    const query = request.query as {
      state?: string
      code?: string
      error?: string
    }
    const stateFromQuery = query.state
    const code = query.code

    if (query.error) {
      console.error('❌ Erro do Discord:', query.error)
      return reply.redirect(
        process.env.FRONTEND_URL +
          '/auth?error=' +
          (query.error === 'access_denied' ? 'access_denied' : 'oauth_failed')
      )
    }

    if (!stateFromQuery) {
      console.error('❌ State inválido')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=invalid_state'
      )
    }

    if (!matchesOAuthStateCookie(request, reply, stateFromQuery)) {
      console.error('❌ State não pertence a este navegador')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=invalid_state'
      )
    }

    const cachedState = await readOAuthState(cacheRepository, stateFromQuery)
    if (!cachedState) {
      console.error('❌ State inválido')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=invalid_state'
      )
    }

    if (!code) {
      console.error('❌ Code ausente')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=missing_code'
      )
    }

    await cacheRepository.del(oauthStateKey(stateFromQuery))
    return authController.discordCallback(
      request,
      reply,
      cachedState.acceptedTerms
    )
  })
}
