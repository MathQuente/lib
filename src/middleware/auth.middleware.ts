import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../database/db'
import { app } from '../server'

interface JwtPayload {
  userId: string
}

export function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const authHeader = request.headers.authorization

  if (!authHeader)
    return reply.status(401).send({ message: 'The token was not informed!' })

  const parts = authHeader.split(' ')
  if (parts.length !== 2)
    return reply.status(401).send({ message: 'Invalid token!' })

  const [scheme, token] = parts

  if (!/^Bearer$/i.test(scheme))
    return reply.status(401).send({ message: 'Malformatted Token!' })

  app.jwt.verify(token, async (err, decoded) => {
    if (err) return reply.status(401).send({ message: 'Invalid token!' })

    const blacklistedToken = await prisma.blacklistedToken.findUnique({
      where: {
        token
      }
    })

    if (blacklistedToken) {
      return reply.status(401).send({ message: 'Token has been invalidated!' })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: (decoded as JwtPayload).userId
      }
    })

    if (!user || !user.id)
      return reply.status(401).send({ message: 'Invalid token!' })

    request.authUser = { id: user.id }

    return done()
  })
}
