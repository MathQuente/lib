import { FastifyInstance } from 'fastify'
import { AuthController } from '../controllers/auth.controller'
import { AuthRepository } from '../repositories/auth.repository'
import { AuthService } from '../services/auth.service'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

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

  app.get('/google/callback', async (request, reply) => {
    return authController.googleCallback(request, reply)
  })

  app.get('/google', async (request, reply) => {
    const oauth2 = (request.server as any).googleOAuth2
    oauth2.generateAuthorizationUri(
      request,
      reply,
      (err: any, authorizationUrl: any) => {
        if (err) {
          request.log.error(err)
          return reply.code(500).send('Erro ao gerar URL de autorização')
        }
        return reply.redirect(authorizationUrl)
      }
    )
  })
}
