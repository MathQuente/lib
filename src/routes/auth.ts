import { FastifyInstance } from 'fastify'
import { AuthController } from '../controllers/auth.controller'
import { AuthRepository } from '../repositories/auth.repository'
import { AuthService } from '../services/auth.service'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import crypto from 'crypto'

// Store temporário para states (mesmo do server.ts)
const stateStore = new Map<string, number>()

// Limpa states expirados
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of stateStore.entries()) {
    if (now - timestamp > 600000) {
      // 10 minutos
      stateStore.delete(key)
    }
  }
}, 300000)

export async function authRoutes(app: FastifyInstance) {
  const authRepository = new AuthRepository()
  const authService = new AuthService(authRepository, app.jwt)
  const authController = new AuthController(authService)

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/register', async (request, reply) =>
      authController.createUser(request, reply)
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/login', async (request, reply) =>
      authController.loginHandler(request, reply)
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

  // ✅ Rota manual para iniciar OAuth (NOVO)
  app.get('/google', async (request, reply) => {
    try {
      const oauth2 = (app as any).googleOAuth2

      if (!oauth2) {
        console.error('❌ OAuth2 plugin não encontrado!')
        return reply.status(500).send({ error: 'OAuth2 not configured' })
      }

      // Gera state manualmente
      const state = crypto.randomBytes(16).toString('hex')
      stateStore.set(state, Date.now())

      console.log(`✅ [MANUAL] State gerado: ${state}`)
      console.log(`📊 States no store:`, Array.from(stateStore.keys()))

      // Constrói a URL manualmente
      const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: 'http://localhost:3333/auth/google/callback',
        response_type: 'code',
        scope: 'openid email profile',
        state: state,
        access_type: 'offline',
        prompt: 'consent'
      })

      const authUrl = `${baseUrl}?${params.toString()}`
      console.log(`🔗 Redirecionando para:`, authUrl)

      return reply.redirect(authUrl)
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error)
      return reply.status(500).send({ error: 'Failed to start OAuth flow' })
    }
  })

  // ✅ Callback do Google
  app.get('/google/callback', async (request, reply) => {
    console.log('=== CALLBACK RECEBIDO ===')
    console.log('URL:', request.url)
    console.log('Query params:', request.query)

    const query = request.query as {
      state?: string
      code?: string
      error?: string
    }
    const stateFromQuery = query.state
    const code = query.code

    console.log(`🔍 Validando state: ${stateFromQuery}`)
    console.log(`📊 States disponíveis:`, Array.from(stateStore.keys()))
    console.log(`📊 Tamanho do store:`, stateStore.size)

    // Verifica se há erro do Google
    if (query.error) {
      console.error('❌ Erro do Google:', query.error)
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=' + query.error
      )
    }

    // Valida state manualmente
    if (!stateFromQuery) {
      console.error('❌ State ausente na query')
      return reply.redirect(
        process.env.FRONTEND_URL + '/auth?error=missing_state'
      )
    }

    if (!stateStore.has(stateFromQuery)) {
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

    // Remove state após validação
    stateStore.delete(stateFromQuery)
    console.log('✅ State validado e removido')

    return authController.googleCallback(request, reply)
  })
}
