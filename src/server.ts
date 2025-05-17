import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'

import cors from '@fastify/cors'
import { gameRoutes } from './routes/game'
import { gameStudioRoutes } from './routes/gameStudios'

import { fastifyJwt } from '@fastify/jwt'
import * as dotenv from 'dotenv'
import { platformsRoutes } from './routes/platforms'
import { userRoutes } from './routes/users'
import { errorHandler } from './error-handler'
import { fastifyCookie } from '@fastify/cookie'
import { authRoutes } from './routes/auth'

dotenv.config()

export const app = fastify()

app.register(cors, {
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173']
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

if (!process.env.SECRET_JWT_KEY) {
  throw new Error('SECRET_JWT_KEY environment variable is required')
}

app.register(fastifyJwt, {
  secret: process.env.SECRET_JWT_KEY
})

app.register(fastifyCookie, {
  secret: process.env.SECRET_JWT_KEY
})

app.setErrorHandler(errorHandler)

app.register(gameStudioRoutes, { prefix: '/gameStudios' })
app.register(gameRoutes, { prefix: '/games' })

app.register(platformsRoutes, { prefix: '/platforms' })
app.register(authRoutes, { prefix: '/auth' })
app.register(userRoutes, { prefix: '/users' })

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running!')
})
