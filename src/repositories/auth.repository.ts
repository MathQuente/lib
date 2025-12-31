import { prisma } from '../database/db'
import { CreateUserDTO } from '../dtos/user.dto'

export class AuthRepository {
  async saveToken(token: string, userId: string, expiresAt: Date) {
    await prisma.refreshToken.deleteMany({
      where: {
        userId: userId,
        isValid: true
      }
    })

    // Agora, cria o novo token
    await prisma.refreshToken.create({
      data: {
        token: token,
        userId: userId,
        expiresAt: expiresAt,
        isValid: true
      }
    })
  }

  async findUserByGoogleId(googleId: string) {
    return prisma.user.findUnique({
      where: { googleId },
      select: { id: true, email: true, userName: true, profilePicture: true }
    })
  }

  async findUserByDiscordId(discordId: string) {
    return prisma.user.findUnique({
      where: { discordId },
      select: { id: true, email: true, userName: true, profilePicture: true }
    })
  }

  async createUser(data: CreateUserDTO) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        userName: data.userName
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
        password: data.password
      },
      select: { id: true }
    })
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    })
  }

  async findByDiscordId(discordId: string) {
    return prisma.user.findUnique({
      where: { discordId }
    })
  }

  async createWithDiscord(data: {
    email: string
    discordId: string
    password: string
  }) {
    return prisma.user.create({ data })
  }

  async linkDiscord(userId: string, discordId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { discordId }
    })
  }

  async invalidateToken(token: string) {
    await prisma.refreshToken.update({
      where: { token: token },
      data: { isValid: false }
    })
  }

  async findToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: {
        token
      }
    })
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email
      },
      select: {
        id: true,
        email: true,
        password: true,
        userName: true
      }
    })
  }
}
