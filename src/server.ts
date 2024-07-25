import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'

import cors from '@fastify/cors'
import { gameRoutes } from './routes/game'
import { gameStudioRoutes } from './routes/game-studio'

import { fastifyJwt } from '@fastify/jwt'
import * as dotenv from 'dotenv'
import { platformsRoutes } from './routes/platforms'
import {
  addGame,
  createUser,
  deleteUser,
  getAllUserGames,
  getAllUsers,
  getGameStatus,
  getUser,
  login,
  removeGame,
  updateUser,
  updateUserGameStatus
} from './routes/user'
import { errorHandler } from './error-handler'

dotenv.config()

export const app = fastify()

app.register(cors, {})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(fastifyJwt, {
  secret: 'process.env.SECRET_JWT_KEY'
})

app.setErrorHandler(errorHandler)

app.register(gameStudioRoutes, { prefix: '/gameStudios' })
app.register(gameRoutes, { prefix: '/games' })
app.register(platformsRoutes, { prefix: '/platforms' })

app.register(createUser)
app.register(login)
app.register(getUser)
app.register(getAllUsers)
app.register(addGame)
app.register(getAllUserGames)
app.register(removeGame)
app.register(updateUser)
app.register(deleteUser)
app.register(updateUserGameStatus)
app.register(getGameStatus)

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running!')
})
