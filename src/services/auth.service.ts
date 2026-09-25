import { JWT } from '@fastify/jwt'
import { AuthRepository } from '../repositories/auth.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { EmailService } from './email.service'
import { ClientError } from '../errors/client-error'
import bcrypt from 'bcrypt'
import { CreateUserDTO } from '../dtos/user.dto'
import { generateFromEmail } from 'unique-username-generator'

const PASSWORD_RESET_TTL_SECONDS = 60 * 60
const passwordResetKey = (token: string) => `password-reset:${token}`

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private jwt: JWT,
    private cacheRepository: CacheRepository,
    private emailService: EmailService = new EmailService()
  ) {}

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

      if (
        !storedToken ||
        !storedToken.isValid ||
        storedToken.expiresAt < new Date()
      ) {
        throw new ClientError('Sessão inválida ou expirada.', 401)
      }

      // Depois verifica a assinatura JWT
      const decoded = this.jwt.verify(refreshToken) as { userId: string }

      // Remove o token usado (rotação de tokens)
      await this.authRepository.invalidateToken(refreshToken)

      return decoded.userId
    } catch (error) {
      if (error instanceof ClientError) {
        throw error
      }
      const { code, message } = error as { code?: string; message?: string }
      if (code === 'FAST_JWT_EXPIRED' || message?.includes('expired')) {
        throw new ClientError('Sessão expirada.', 401)
      }
      throw new ClientError('Sessão inválida.', 401)
    }
  }

  // Checagem só-leitura, sem rotação: usada pelo fallback silencioso do
  // authenticateDecorator (jwt.ts) pra renovar o access token sem invalidar
  // o refresh token a cada 15 minutos.
  async isRefreshTokenActive(refreshToken: string): Promise<string | null> {
    const storedToken = await this.authRepository.findToken(refreshToken)

    if (
      !storedToken ||
      !storedToken.isValid ||
      storedToken.expiresAt < new Date()
    ) {
      return null
    }

    try {
      const decoded = this.jwt.verify(refreshToken) as { userId: string }
      return decoded.userId
    } catch {
      return null
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
    const emailIsAlreadyUsed = await this.authRepository.findByEmail(data.email)

    if (emailIsAlreadyUsed) {
      throw new ClientError('Este email já está em uso.')
    }

    const passwordAfterHash = await bcrypt.hash(data.password, 10)
    const userNameGenerated = generateFromEmail(data.email, 4)

    const user = await this.authRepository.createUser({
      email: data.email,
      password: passwordAfterHash,
      userName: userNameGenerated
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
    // Primeiro tenta encontrar por googleId
    let user = await this.authRepository.findUserByGoogleId(profile.sub)

    if (!user) {
      // Se não encontrou por googleId, busca por email
      user = await this.authRepository.findByEmail(profile.email)

      if (user) {
        // Usuário existe com esse email, vincula o Google ID
        user = await this.authRepository.linkGoogle(
          user.id,
          profile.sub,
          profile.picture
        )
      } else {
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
    }

    const { accessToken, refreshToken, expiresAt } = await this.generateTokens(
      user.id
    )

    return { user, accessToken, refreshToken, expiresAt }
  }

  async loginWithDiscord(discordUser: {
    id: string
    email: string
    username: string
    avatar: string | null
  }) {
    let user = await this.authRepository.findByDiscordId(discordUser.id)

    const profilePicture = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    if (!user) {
      user = await this.authRepository.findByEmail(discordUser.email)

      if (user) {
        user = await this.authRepository.linkDiscord(
          user.id,
          discordUser.id,
          profilePicture
        )
      } else {
        const hashedPassword = await bcrypt.hash(crypto.randomUUID(), 10)
        user = await this.authRepository.createWithDiscord({
          email: discordUser.email,
          userName: `${discordUser.username}`,
          discordId: discordUser.id,
          password: hashedPassword,
          profilePicture
        })
      }
    }

    return this.generateTokens(user.id)
  }

  async validateUser(email: string, password: string) {
    const user = await this.authRepository.findByEmail(email, true)

    const infoIsMatch = user && (await bcrypt.compare(password, user.password))

    if (!infoIsMatch) {
      throw new ClientError('Email ou senha incorretos.')
    }

    return {
      user: {
        id: user.id,
        userName: user.userName
      }
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.authRepository.findByEmail(email)

    if (!user) return

    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    await this.cacheRepository.set(
      passwordResetKey(token),
      user.id,
      PASSWORD_RESET_TTL_SECONDS
    )

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl)
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = (await this.cacheRepository.get(
      passwordResetKey(token)
    )) as string | null

    if (!userId) {
      throw new ClientError('Link de redefinição inválido ou expirado.', 400)
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await this.authRepository.updatePassword(userId, hashedPassword)
    await this.cacheRepository.del(passwordResetKey(token))
  }

  async logout(refreshToken: string, accessToken?: string) {
    if (refreshToken) {
      await this.authRepository.invalidateToken(refreshToken)
    }

    if (accessToken) {
      try {
        const decoded = this.jwt.verify(accessToken) as { exp: number }
        const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000)

        if (ttlSeconds > 0) {
          await this.cacheRepository.set(
            `revoked:${accessToken}`,
            true,
            ttlSeconds
          )
        }
      } catch {
        // Token já inválido/expirado — nada pra revogar.
      }
    }
  }
}
