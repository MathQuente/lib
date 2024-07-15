import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../database/db'

export async function platformsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: z.object({
          platformName: z.string().min(1)
        }),
        response: {
          200: z.object({
            platformId: z.string().uuid()
          })
        }
      }
    },
    async (request, reply) => {
      const { platformName } = request.body

      const consoleWithSameName = await prisma.platform.findUnique({
        where: {
          platformName
        }
      })

      if (consoleWithSameName !== null) {
        throw new Error('Another console with same name already exists')
      }

      const platform = await prisma.platform.create({
        data: {
          platformName
        },
        select: {
          id: true
        }
      })

      return reply.send({ platformId: platform.id })
    }
  )
}
