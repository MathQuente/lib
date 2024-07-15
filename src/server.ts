import fastify, { FastifyError } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'

import cors from '@fastify/cors'
import { gameRoutes } from './routes/game'
import { gameStudioRoutes } from './routes/game-studio'

import { fastifyJwt } from '@fastify/jwt'
import * as dotenv from 'dotenv'
import { ZodError } from 'zod'
import { platformsRoutes } from './routes/platforms'
import {
  addGame,
  createUser,
  deleteUser,
  getAllUsers,
  getGameStatus,
  getUser,
  login,
  removeGame,
  updateUser,
  updateUserGameStatus
} from './routes/user'

dotenv.config()

export const app = fastify()

app.register(cors, {})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(fastifyJwt, {
  secret: 'process.env.SECRET_JWT_KEY'
})

app.setErrorHandler((error: FastifyError, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error',
      issues: error.issues
    })
  } else if (error instanceof Error) {
    return reply.status(500).send({
      message: error.message
    })
  }
})

app.register(gameStudioRoutes, { prefix: '/gameStudios' })
app.register(gameRoutes, { prefix: '/games' })
app.register(platformsRoutes, { prefix: '/platforms' })

app.register(createUser)
app.register(login)
app.register(getUser)
app.register(getAllUsers)
app.register(addGame)
// app.register(getAllUserGames)
app.register(removeGame)
app.register(updateUser)
app.register(deleteUser)
app.register(updateUserGameStatus)
app.register(getGameStatus)

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running!')
})
