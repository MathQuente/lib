import { FastifyInstance } from 'fastify'
import { AuthController } from '../controllers/auth.controller'
import { AuthRepository } from '../repositories/auth.repository'
import { AuthService } from '../services/auth.service'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { authMiddleware } from '../middleware/auth.middleware'

export async function authRoutes(app: FastifyInstance) {
  const authRepository = new AuthRepository()
  const authService = new AuthService(authRepository, app.jwt)
  const authController = new AuthController(authService)

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/', async (request, reply) =>
      authController.createUser(request, reply)
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/login', async (request, reply) =>
      authController.loginHandler(request, reply)
    )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/refresh',
    {
      onRequest: [authMiddleware]
    },
    async (request, reply) => authController.refreshTokenHandler(request, reply)
  )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/logout', async (request, reply) =>
      authController.logoutHandler(request, reply)
    )
}
