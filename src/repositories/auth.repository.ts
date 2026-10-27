import { prisma } from '../database/db'
import { CreateUserDTO } from '../dtos/user.dto'
import { hashToken } from '../utils/hash-token'
import { termsAcceptance } from '../utils/terms'

const MAX_SESSIONS_PER_USER = 10

export class AuthRepository {
  async saveToken(token: string, userId: string, expiresAt: Date) {
    await prisma.$transaction(async tx => {
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

  async linkGoogle(userId: string, googleId: string, picture?: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        ...(picture && { profilePicture: picture })
      }
    })
  }

  async linkDiscord(
    userId: string,
    discordId: string,
    profilePicture: string | null
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        discordId,
        ...(profilePicture && { profilePicture })
      }
    })
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
