import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler
} from 'fastify-type-provider-zod'
import { createGameStudio, getGameStudio } from './routes/game-studio'
import {
  addGame,
  createUser,
  deleteUser,
  getAllUserGames,
  getAllUsers,
  getUser,
  removeGame,
  updateGameStatus,
  updateUser
} from './routes/user'
import { createGame, getAllGames, getGame } from './routes/game'

const app = fastify()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(createGameStudio)
app.register(getGameStudio)

app.register(getGame)
app.register(createGame)
app.register(getAllGames)

app.register(createUser)
app.register(getUser)
app.register(getAllUsers)
app.register(addGame)
app.register(removeGame)
app.register(updateGameStatus)
app.register(getAllUserGames)
app.register(updateUser)
app.register(deleteUser)

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running!')
})
