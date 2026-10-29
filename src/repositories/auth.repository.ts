import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { ClientError } from '../errors/client-error'
import { CreateUserDTO } from '../dtos/user.dto'
import { hashToken } from '../utils/hash-token'
import { termsAcceptance } from '../utils/terms'

const MAX_SESSIONS_PER_USER = 10

export class AuthRepository {
  private async persistToken(
    tx: Prisma.TransactionClient,
    token: string,
    userId: string,
    expiresAt: Date
  ) {
    await tx.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ isValid: false }, { expiresAt: { lt: new Date() } }]
      }
    })

    await tx.refreshToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: userId,
        expiresAt: expiresAt,
        isValid: true
      }
    })

    const oldestBeyondLimit = await tx.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_SESSIONS_PER_USER,
      select: { id: true }
    })

    if (oldestBeyondLimit.length > 0) {
      await tx.refreshToken.deleteMany({
        where: { id: { in: oldestBeyondLimit.map(token => token.id) } }
      })
    }
  }

  async saveToken(token: string, userId: string, expiresAt: Date) {
    await prisma.$transaction(tx =>
      this.persistToken(tx, token, userId, expiresAt)
    )
  }

  async rotateToken(
    oldToken: string,
    newToken: string,
    userId: string,
    expiresAt: Date
  ) {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR SHARE`
      const { count } = await tx.refreshToken.updateMany({
        where: { tokenHash: hashToken(oldToken), isValid: true },
        data: { isValid: false }
      })

      if (count !== 1) {
        throw new ClientError('Sessão inválida ou expirada.', 401)
      }

      await this.persistToken(tx, newToken, userId, expiresAt)
    })
  }

  async findUserByGoogleId(googleId: string) {
    return prisma.user.findUnique({
      where: { googleId },
      select: { id: true, email: true, userName: true, profilePicture: true }
    })
  }

  async createUser(data: CreateUserDTO) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        userName: data.userName,
        ...termsAcceptance()
      },
      select: {
        id: true
      }
    })
  }

  async createUserWithGoogle(data: {
    email: string
    name: string
    picture: string
    googleId: string
    password: string
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        userName: data.name,
        profilePicture: data.picture,
        googleId: data.googleId,
        password: data.password,
        emailVerifiedAt: new Date(),
        ...termsAcceptance()
      },
      select: { id: true }
    })
  }

  async findByEmail(email: string, includePassword = false) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        userName: true,
        profilePicture: true,
        googleId: true,
        discordId: true,
        ...(includePassword ? { password: true } : {})
      }
    })
  }

  async findByDiscordId(discordId: string) {
    return prisma.user.findUnique({
      where: { discordId },
      select: {
        id: true,
        email: true,
        userName: true,
        profilePicture: true,
        googleId: true,
        discordId: true
      }
    })
  }

  async findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true }
    })
  }

  async markEmailVerified(userId: string) {
    await prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() }
    })
  }

  async createWithDiscord(data: {
    email: string
    userName: string
    discordId: string
    password: string
    profilePicture: string | null
  }) {
    return prisma.user.create({
      data: { ...data, emailVerifiedAt: new Date(), ...termsAcceptance() }
    })
  }

  private async linkProvider(
    userId: string,
    data: Prisma.UserUpdateInput,
    discardedPasswordHash: string | null
  ) {
    return prisma.$transaction(async tx => {
      if (discardedPasswordHash) {
        await tx.user.update({
          where: { id: userId },
          data: { password: discardedPasswordHash }
        })
        await tx.refreshToken.deleteMany({ where: { userId } })
      }

      const user = await tx.user.update({ where: { id: userId }, data })

      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() }
      })

      return user
    })
  }

  async linkGoogle(
    userId: string,
    googleId: string,
    picture: string | undefined,
    discardedPasswordHash: string | null
  ) {
    return this.linkProvider(
      userId,
      { googleId, ...(picture && { profilePicture: picture }) },
      discardedPasswordHash
    )
  }

  async linkDiscord(
    userId: string,
    discordId: string,
    profilePicture: string | null,
    discardedPasswordHash: string | null
  ) {
    return this.linkProvider(
      userId,
      { discordId, ...(profilePicture && { profilePicture }) },
      discardedPasswordHash
    )
  }

  async invalidateToken(token: string) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { isValid: false }
    })
  }

  async deleteTokensByUserId(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } })
  }

  async findToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: {
        tokenHash: hashToken(token)
      }
    })
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: { email: true }
    })
  }
}
