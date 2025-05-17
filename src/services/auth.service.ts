import { JWT } from '@fastify/jwt'
import { FastifyReply } from 'fastify'
import { AuthRepository } from '../repositories/auth.repository'
import { ClientError } from '../errors/client-error'
import bcrypt from 'bcrypt'
import { CreateUserDTO } from '../dtos/users.dto'
import { generateFromEmail } from 'unique-username-generator'

export class AuthService {
  constructor(private authRepository: AuthRepository, private jwt: JWT) {}

  async generateTokens(userId: string) {
    const accessToken = this.jwt.sign({ userId }, { expiresIn: '15min' })
    const refreshToken = this.jwt.sign({ userId }, { expiresIn: '7d' })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await this.authRepository.saveToken(refreshToken, userId, expiresAt)

    return { accessToken, refreshToken, expiresAt }
  }

  async validateRefreshToken(refreshToken: string) {
    try {
      // Verifique se o token existe no banco de dados
      const storedToken = await this.authRepository.findToken(refreshToken)

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new Error('invalid or expired refresh token')
      }

      // Tenta verificar e decodificar o token
      const decoded = this.jwt.verify(refreshToken) as { userId: string }

      // Se o token for válido, invalide o token antigo
      await this.authRepository.invalidateToken(refreshToken)

      // Retorne o userId decodificado
      return decoded.userId
    } catch (error: any) {
      // Captura o erro se o token expirou
      if (error.code === 'FAST_JWT_EXPIRED') {
        throw new Error('Refresh token expired')
      }

      // Caso o token seja malformado ou inválido, trate com outro erro
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

    const accessToken = this.jwt.sign(
      { userId: user.id },
      { expiresIn: '15min' }
    )
    const refreshToken = this.jwt.sign({ userId: user.id }, { expiresIn: '7d' })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id
      }
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.authRepository.findUserByEmail(email)

    const infoIsMatch = user && (await bcrypt.compare(password, user.password))

    if (!infoIsMatch) {
      throw new ClientError('Email or password wrong')
    }

    return user
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.authRepository.invalidateToken(refreshToken)
    }
  }
}
