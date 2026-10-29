import { prisma } from '../database/db'
import { redis } from '../database/redis'
import { bullConnection } from '../queues/connection'

export class HealthRepository {
  checkDatabase() {
    return prisma.$queryRaw`SELECT 1`
  }

  checkRedis() {
    return redis.ping()
  }

  closeDatabase() {
    return prisma.$disconnect()
  }

  closeRedis() {
    return redis.quit()
  }

  closeQueueConnection() {
    return bullConnection.quit()
  }
}
