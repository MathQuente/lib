import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../database/db'
import { app } from '../server'

export function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: any
) {
  const authHeader = request.headers.authorization

  if (!authHeader)
    return reply.status(401).send({ message: 'The token was not informed!' })

  const parts = authHeader.split(' ') /* ["Bearer", "asdasdasdadsadasd"] */
  if (parts.length !== 2)
    return reply.status(401).send({ message: 'Invalid token!' })

  const [scheme, token] = parts

  if (!/^Bearer$/i.test(scheme))
    return reply.status(401).send({ message: 'Malformatted Token!' })

  app.jwt.verify(token, async (err, decoded) => {
    if (err) return reply.status(401).send({ message: 'Invalid token!' })
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId
      }
    })

    if (!user || !user.id)
      return reply.status(401).send({ message: 'Invalid token!' })

    request.user = user.id

    return done()
  })
}
