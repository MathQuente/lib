import 'dotenv/config'
import { Server } from './server'

Server.start().catch(error => {
  console.error('Server failed to start:', error)
  process.exit(1)
})
