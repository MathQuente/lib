import { FastifyReply, FastifyRequest } from 'fastify'
import { ClientError } from '../errors/client-error'

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Pega o token do header Authorization
    const authHeader = request.headers.authorization

    if (!authHeader) {
      throw new ClientError('No token provided')
    }

    const [, token] = authHeader.split(' ') // Remove o "Bearer" do início

    if (!token) {
      throw new ClientError('No token provided')
    }

    // Verifica e decodifica o token
    const decoded = request.server.jwt.verify(token)

    // Adiciona o usuário decodificado à request para uso nas rotas
    request.user = decoded
  } catch (error: any) {
    if (error.code === 'FAST_JWT_EXPIRED') {
      return reply.status(401).send({ message: 'Token expired' })
    }

    return reply.status(401).send({ message: 'Invalid token' })
  }
}
