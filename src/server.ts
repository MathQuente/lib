import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'
import { gameStudioRoutes } from './routes/game-studio'
import { userRoutes } from './routes/user'
import { gameRoutes } from './routes/game'

const app = fastify()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(gameStudioRoutes)
app.register(gameRoutes)

app.register(userRoutes)

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running!')
})
