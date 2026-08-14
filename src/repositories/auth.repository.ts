import { prisma } from '../database/db'
import { CreateUserDTO } from '../dtos/user.dto'

export class AuthRepository {
  async saveToken(token: string, userId: string, expiresAt: Date) {
    // Remove qualquer token anterior do usuário (válido ou já invalidado).
    // JWTs assinados no mesmo segundo pro mesmo userId são idênticos (o `iat`
    // só tem resolução de segundo) — se um token invalidado ficasse pra trás
    // aqui, um refresh rápido o suficiente colidiria com a constraint única
    // de `token` ao tentar criar o novo.
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { userId }
      }),
      prisma.refreshToken.create({
        data: {
          token: token,
          userId: userId,
          expiresAt: expiresAt,
          isValid: true
        }
      })
    ])
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

  async createWithDiscord(data: {
    email: string
    userName: string
    discordId: string
    password: string
    profilePicture: string | null
  }) {
    return prisma.user.create({ data })
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
}
