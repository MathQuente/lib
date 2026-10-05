import { JWT } from '@fastify/jwt'
import { AuthRepository } from '../repositories/auth.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { EmailService } from './email.service'
import { ClientError } from '../errors/client-error'
import bcrypt from 'bcrypt'
import { CreateUserDTO } from '../dtos/user.dto'
import { generateFromEmail } from 'unique-username-generator'
import { hashToken } from '../utils/hash-token'
import { RecentAuthService } from './recent-auth.service'

const BCRYPT_COST = 12

const PASSWORD_RESET_TTL_SECONDS = 60 * 60
const passwordResetKey = (token: string) =>
  `password-reset:${hashToken(token)}`

const MAX_RESET_REQUESTS_PER_HOUR = 3
const RESET_REQUESTS_WINDOW_SECONDS = 60 * 60
const passwordResetRequestsKey = (email: string) =>
  `password-reset-requests:${hashToken(email.toLowerCase())}`

const MAX_LOGIN_FAILURES = 10
const LOGIN_FAILURES_WINDOW_SECONDS = 15 * 60
const loginFailuresKey = (email: string) =>
  `login-failures:${hashToken(email.toLowerCase())}`

export const revokedAccessTokenKey = (accessToken: string) =>
  `revoked:${hashToken(accessToken)}`

let dummyPasswordHash: Promise<string> | undefined
function getDummyPasswordHash() {
  dummyPasswordHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_COST)
  return dummyPasswordHash
}

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15
export const sessionsRevokedAtKey = (userId: string) =>
  `sessions-revoked-at:${userId}`

const UNVERIFIED_PROVIDER_EMAIL_MESSAGE =
  'O email dessa conta não foi verificado pelo provedor.'

export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private jwt: JWT,
    private cacheRepository: CacheRepository,
    private emailService: EmailService = new EmailService(),
    private recentAuthService: RecentAuthService = new RecentAuthService(
      cacheRepository
    )
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

    const passwordAfterHash = await bcrypt.hash(data.password, BCRYPT_COST)
    const userNameGenerated = generateFromEmail(data.email, 4)

    const user = await this.authRepository.createUser({
      email: data.email,
      password: passwordAfterHash,
      userName: userNameGenerated
    })

    const { accessToken, refreshToken } = await this.generateTokens(user.id)
    await this.recentAuthService.mark(user.id)

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id
      }
    }
  }

  private async takeOverUnverifiedAccount(userId: string) {
    const hashedPassword = await bcrypt.hash(crypto.randomUUID(), BCRYPT_COST)
    await this.authRepository.updatePassword(userId, hashedPassword)
    await this.revokeAllSessions(userId)
  }

  async revokeAllSessions(userId: string) {
    await this.authRepository.deleteTokensByUserId(userId)
    await this.cacheRepository.set(
      sessionsRevokedAtKey(userId),
      Math.floor(Date.now() / 1000),
      ACCESS_TOKEN_TTL_SECONDS
    )
  }

  async loginWithGoogle(profile: {
    sub: string
    email: string
    email_verified?: boolean
    name: string
    picture: string
  }) {
    // Primeiro tenta encontrar por googleId
    let user = await this.authRepository.findUserByGoogleId(profile.sub)

    if (!user) {
      if (!profile.email || profile.email_verified !== true) {
        throw new ClientError(UNVERIFIED_PROVIDER_EMAIL_MESSAGE, 403)
      }

      // Se não encontrou por googleId, busca por email
      const existing = await this.authRepository.findByEmail(profile.email)

      if (existing) {
        if (!existing.discordId) {
          await this.takeOverUnverifiedAccount(existing.id)
        }

        // Usuário existe com esse email, vincula o Google ID
        user = await this.authRepository.linkGoogle(
          existing.id,
          profile.sub,
          profile.picture
        )
      } else {
        const array = new Uint8Array(32)
        crypto.getRandomValues(array)
        const randomPassword = Array.from(array, byte =>
          byte.toString(16).padStart(2, '0')
        ).join('')
        const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_COST)

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
    await this.recentAuthService.mark(user.id)

    return { user, accessToken, refreshToken, expiresAt }
  }

  async loginWithDiscord(discordUser: {
    id: string
    email: string
    verified?: boolean
    username: string
    avatar: string | null
  }) {
    let user = await this.authRepository.findByDiscordId(discordUser.id)

    const profilePicture = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    if (!user) {
      if (!discordUser.email || discordUser.verified !== true) {
        throw new ClientError(UNVERIFIED_PROVIDER_EMAIL_MESSAGE, 403)
      }

      user = await this.authRepository.findByEmail(discordUser.email)

      if (user) {
        if (!user.googleId) await this.takeOverUnverifiedAccount(user.id)

        user = await this.authRepository.linkDiscord(
          user.id,
          discordUser.id,
          profilePicture
        )
      } else {
        const hashedPassword = await bcrypt.hash(
          crypto.randomUUID(),
          BCRYPT_COST
        )
        user = await this.authRepository.createWithDiscord({
          email: discordUser.email,
          userName: `${discordUser.username}`,
          discordId: discordUser.id,
          password: hashedPassword,
          profilePicture
        })
      }
    }

    const tokens = await this.generateTokens(user.id)
    await this.recentAuthService.mark(user.id)
    return tokens
  }

  async validateUser(email: string, password: string) {
    const failuresKey = loginFailuresKey(email)
    const failures = await this.cacheRepository.get(failuresKey)
    if (typeof failures === 'number' && failures >= MAX_LOGIN_FAILURES) {
      throw new ClientError(
        'Muitas tentativas de login. Tente novamente mais tarde.',
        429
      )
    }

    const user = await this.authRepository.findByEmail(email, true)

    const infoIsMatch = await bcrypt.compare(
      password,
      user?.password ?? (await getDummyPasswordHash())
    )

    if (!user || !infoIsMatch) {
      await this.cacheRepository.increment(
        failuresKey,
        LOGIN_FAILURES_WINDOW_SECONDS
      )
      throw new ClientError('Email ou senha incorretos.')
    }

    await this.cacheRepository.del(failuresKey)
    await this.recentAuthService.mark(user.id)

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

    const requests = await this.cacheRepository.increment(
      passwordResetRequestsKey(email),
      RESET_REQUESTS_WINDOW_SECONDS
    )
    if (requests > MAX_RESET_REQUESTS_PER_HOUR) return

    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    await this.cacheRepository.set(
      passwordResetKey(token),
      user.id,
      PASSWORD_RESET_TTL_SECONDS
    )

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetUrl)
    } catch (err) {
      console.error('[PasswordReset] email delivery failed', {
        error: err instanceof Error ? err.message : 'unknown error'
      })
      if (process.env.NODE_ENV !== 'production') {
        console.info('[PasswordReset] dev reset link:', resetUrl)
      }
    }
  }

  async isPasswordResetTokenValid(token: string): Promise<boolean> {
    return (await this.cacheRepository.get(passwordResetKey(token))) !== null
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = (await this.cacheRepository.getdel(
      passwordResetKey(token)
    )) as string | null

    if (!userId) {
      throw new ClientError('Link de redefinição inválido ou expirado.', 400)
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST)
    await this.authRepository.updatePassword(userId, hashedPassword)
    await this.revokeAllSessions(userId)
  }

  async logout(refreshToken?: string, accessToken?: string) {
    if (refreshToken) {
      await this.authRepository.invalidateToken(refreshToken)
    }

    if (accessToken) {
      try {
        const decoded = this.jwt.verify(accessToken) as { exp: number }
        const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000)

        if (ttlSeconds > 0) {
          await this.cacheRepository.set(
            revokedAccessTokenKey(accessToken),
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
