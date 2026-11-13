import { availableParallelism } from 'node:os'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './prisma-client'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  max: availableParallelism() * 2 + 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 300_000
})

export const prisma = new PrismaClient({ adapter })
