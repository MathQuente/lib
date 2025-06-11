import { JWT } from '@fastify/jwt'
import { FastifyReply } from 'fastify'
import { AuthRepository } from '../repositories/auth.repository'
import { ClientError } from '../errors/client-error'
import bcrypt from 'bcrypt'
import { CreateUserDTO } from '../dtos/user.dto'
import { generateFromEmail } from 'unique-username-generator'

export class AuthService {
  constructor(private authRepository: AuthRepository, private jwt: JWT) {}

  async generateTokens(userId: string) {
    const accessToken = this.jwt.sign({ userId }, { expiresIn: '15m' })

    const refreshToken = this.jwt.sign({ userId }, { expiresIn: '7d' })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await this.authRepository.saveToken(refreshToken, userId, expiresAt)

    return { accessToken, refreshToken, expiresAt }
  }

  async validateRefreshToken(refreshToken: string) {
    try {
      // Primeiro verifica no banco
      const storedToken = await this.authRepository.findToken(refreshToken)

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new Error('invalid or expired refresh token')
      }

      // Depois verifica a assinatura JWT
      const decoded = this.jwt.verify(refreshToken) as { userId: string }

      // Remove o token usado (rotação de tokens)
      await this.authRepository.invalidateToken(refreshToken)

      return decoded.userId
    } catch (error: any) {
      if (
        error.code === 'FAST_JWT_EXPIRED' ||
        error.message?.includes('expired')
      ) {
        throw new Error('Refresh token expired')
      }
      throw new Error('Invalid refresh token')
    }
  }

  async refreshTokens(refreshToken: string) {
    const userId = await this.validateRefreshToken(refreshToken)

    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt
    } = await this.generateTokens(userId)

    return { accessToken, refreshToken: newRefreshToken, expiresAt }
  }

  async createUser(data: CreateUserDTO) {
    const emailIsAlreadyUsed = await this.authRepository.findUserByEmail(
      data.email
    )

    if (emailIsAlreadyUsed) {
      throw new ClientError('This email is already used')
    }

    const passwordAfterHash = await bcrypt.hash(data.password, 10)
    const userNameGeneretad = generateFromEmail(data.email, 4)

    const user = await this.authRepository.createUser({
      email: data.email,
      password: passwordAfterHash,
      userName: userNameGeneretad
    })

    const { accessToken, refreshToken } = await this.generateTokens(user.id)

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id
      }
    }
  }

  async loginWithGoogle(profile: {
    sub: string
    email: string
    name: string
    picture: string
  }) {
    let user = await this.authRepository.findUserByGoogleId(profile.sub)

    if (!user) {
      const array = new Uint8Array(32)
      crypto.getRandomValues(array)
      const randomPassword = Array.from(array, byte =>
        byte.toString(16).padStart(2, '0')
      ).join('')
      const hashedPassword = await bcrypt.hash(randomPassword, 10)

      const created = await this.authRepository.createUserWithGoogle({
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        googleId: profile.sub,
        password: hashedPassword
      })
      user = {
        id: created.id,
        email: profile.email,
        userName: profile.name,
        profilePicture: profile.picture
      }
    }

    // Depois de ter o user.id, gere seus tokens (reaproveitando generateTokens)
    const { accessToken, refreshToken, expiresAt } = await this.generateTokens(
      user.id
    )

    return { user, accessToken, refreshToken, expiresAt }
  }

  async validateUser(email: string, password: string) {
    const user = await this.authRepository.findUserByEmail(email)

    const infoIsMatch = user && (await bcrypt.compare(password, user.password))

    if (!infoIsMatch) {
      throw new ClientError('Email or password wrong')
    }

    return {
      user: {
        id: user.id
      }
    }
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.authRepository.invalidateToken(refreshToken)
    }
  }
}
