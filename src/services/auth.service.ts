import { JWT } from '@fastify/jwt'
import { AuthRepository } from '../repositories/auth.repository'
import { CacheRepository } from '../repositories/cache.repository'
import { EmailService } from './email.service'
import { ClientError } from '../errors/client-error'
import { TermsRequiredError } from '../errors/terms-required-error'
import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { CreateUserDTO } from '../dtos/user.dto'
import { generateFromEmail } from 'unique-username-generator'
import { hashToken } from '../utils/hash-token'
import { RecentAuthService } from './recent-auth.service'
import { markSessionsRevoked } from '../utils/session-revocation'
import { logError } from '../utils/respond-unavailable'
import { normalizeEmail } from '../utils/normalize-email'

const BCRYPT_COST = 12

const PASSWORD_RESET_TTL_SECONDS = 60 * 60
const passwordResetKey = (token: string) =>
  `password-reset:${hashToken(token)}`

const MAX_RESET_REQUESTS_PER_HOUR = 3
const RESET_REQUESTS_WINDOW_SECONDS = 60 * 60
const passwordResetRequestsKey = (email: string) =>
  `password-reset-requests:${hashToken(normalizeEmail(email))}`

const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60
const emailVerificationKey = (tokenHash: string) =>
  `email-verification:${tokenHash}`
const emailVerificationCurrentKey = (userId: string) =>
  `email-verification-current:${userId}`

const MAX_VERIFICATION_REQUESTS_PER_HOUR = 3
const VERIFICATION_REQUESTS_WINDOW_SECONDS = 60 * 60
const emailVerificationRequestsKey = (userId: string) =>
  `email-verification-requests:${userId}`

function randomToken() {
  return randomBytes(32).toString('hex')
}

const MAX_LOGIN_FAILURES_PER_IP = 10
const MAX_LOGIN_FAILURES_PER_EMAIL = 50
const LOGIN_FAILURES_WINDOW_SECONDS = 15 * 60
const loginFailuresByEmailKey = (email: string) =>
  `login-failures:${hashToken(normalizeEmail(email))}`
const loginFailuresByIpKey = (email: string, ip: string) =>
  `${loginFailuresByEmailKey(email)}:${hashToken(ip)}`
const FAMILIAR_IP_TTL_SECONDS = 30 * 24 * 60 * 60
const familiarIpKey = (email: string, ip: string) =>
  `login-familiar-ip:${hashToken(normalizeEmail(email))}:${hashToken(ip)}`
const hasReached = (failures: unknown, limit: number) =>
  typeof failures === 'number' && failures >= limit

export const revokedAccessTokenKey = (accessToken: string) =>
  `revoked:${hashToken(accessToken)}`

let dummyPasswordHash: Promise<string> | undefined
function getDummyPasswordHash() {
  dummyPasswordHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_COST)
  return dummyPasswordHash
}

const PROVIDER_ALREADY_LINKED_MESSAGE =
  'Este email já está vinculado a outra conta desse provedor.'

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

  private signTokens(userId: string) {
    const accessToken = this.jwt.sign(
      { userId, tokenType: 'access' },
      { expiresIn: '15m' }
    )

    const refreshToken = this.jwt.sign(
      { userId, tokenType: 'refresh', jti: crypto.randomUUID() },
      { expiresIn: '7d' }
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    return { accessToken, refreshToken, expiresAt }
  }

  async generateTokens(userId: string) {
    const tokens = this.signTokens(userId)

    await this.authRepository.saveToken(
      tokens.refreshToken,
      userId,
      tokens.expiresAt
    )

    return tokens
  }

  async validateRefreshToken(refreshToken: string) {
    const storedToken = await this.authRepository.findToken(refreshToken)

    if (
      !storedToken ||
      !storedToken.isValid ||
      storedToken.expiresAt < new Date()
    ) {
      throw new ClientError('Sessão inválida ou expirada.', 401)
    }

    let userId: string
    try {
      const decoded = this.jwt.verify(refreshToken) as {
        userId: string
        tokenType?: string
      }
      if (decoded.tokenType === 'access') {
        throw new ClientError('Sessão inválida.', 401)
      }
      userId = decoded.userId
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

    return userId
  }

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
      const decoded = this.jwt.verify(refreshToken) as {
        userId: string
        tokenType?: string
      }
      return decoded.tokenType === 'access' ? null : decoded.userId
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
    } = this.signTokens(userId)

    await this.authRepository.rotateToken(
      refreshToken,
      newRefreshToken,
      userId,
      expiresAt
    )

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
    await this.issueEmailVerification(user.id, data.email)

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id
      }
    }
  }

  private async issueEmailVerification(userId: string, email: string) {
    const token = randomToken()
    const tokenHash = hashToken(token)

    await this.cacheRepository.set(
      emailVerificationKey(tokenHash),
      userId,
      EMAIL_VERIFICATION_TTL_SECONDS
    )

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`

    try {
      await this.emailService.sendEmailVerificationEmail(email, verifyUrl)
    } catch (err) {
      console.error('[EmailVerification] email delivery failed', {
        error: err instanceof Error ? err.message : 'unknown error'
      })
      if (process.env.NODE_ENV !== 'production') {
        console.info('[EmailVerification] dev verification link:', verifyUrl)
      }
      return false
    }

    const previousHash = await this.cacheRepository.get(
      emailVerificationCurrentKey(userId)
    )
    if (typeof previousHash === 'string') {
      await this.cacheRepository.del(emailVerificationKey(previousHash))
    }
    await this.cacheRepository.set(
      emailVerificationCurrentKey(userId),
      tokenHash,
      EMAIL_VERIFICATION_TTL_SECONDS
    )
    return true
  }

  async verifyEmail(token: string) {
    const userId = (await this.cacheRepository.getdel(
      emailVerificationKey(hashToken(token))
    )) as string | null

    if (!userId) {
      throw new ClientError('Link de verificação inválido ou expirado.', 400)
    }

    await this.authRepository.markEmailVerified(userId)
    await this.cacheRepository.del(emailVerificationCurrentKey(userId))
  }

  async resendEmailVerification(userId: string) {
    const user = await this.authRepository.findById(userId)
    if (!user) throw new ClientError('Usuário não encontrado.', 404)
    if (user.emailVerifiedAt) return

    const requests = await this.cacheRepository.increment(
      emailVerificationRequestsKey(userId),
      VERIFICATION_REQUESTS_WINDOW_SECONDS
    )
    if (requests > MAX_VERIFICATION_REQUESTS_PER_HOUR) {
      throw new ClientError(
        'Muitos pedidos de verificação. Tente novamente mais tarde.',
        429
      )
    }

    const sent = await this.issueEmailVerification(user.id, user.email)
    if (!sent) {
      throw new ClientError('Não foi possível enviar o email agora.', 503)
    }
  }

  private randomPasswordHash() {
    return bcrypt.hash(crypto.randomUUID(), BCRYPT_COST)
  }

  async revokeAllSessions(userId: string) {
    await this.authRepository.deleteTokensByUserId(userId)
    await markSessionsRevoked(this.cacheRepository, userId)
  }

  private async markRevokedAfterLink(userId: string) {
    try {
      await markSessionsRevoked(this.cacheRepository, userId)
    } catch (error) {
      logError('Post-link session revocation failed:', error)
    }
  }

  async loginWithGoogle(
    profile: {
      sub: string
      email: string
      email_verified?: boolean
      name: string
      picture: string
    },
    acceptedTerms: boolean
  ) {
    let user = await this.authRepository.findUserByGoogleId(profile.sub)

    if (!user) {
      if (!profile.email || profile.email_verified !== true) {
        throw new ClientError(UNVERIFIED_PROVIDER_EMAIL_MESSAGE, 403)
      }

      const email = normalizeEmail(profile.email)

      const existing = await this.authRepository.findByEmail(email)

      if (existing) {
        if (existing.googleId) {
          throw new ClientError(PROVIDER_ALREADY_LINKED_MESSAGE, 409)
        }

        const discardedPasswordHash = existing.discordId
          ? null
          : await this.randomPasswordHash()

        if (discardedPasswordHash) {
          await markSessionsRevoked(this.cacheRepository, existing.id)
        }

        user = await this.authRepository.linkGoogle(
          existing.id,
          profile.sub,
          profile.picture,
          discardedPasswordHash
        )

        if (discardedPasswordHash) {
          await this.markRevokedAfterLink(existing.id)
        }
      } else {
        if (!acceptedTerms) throw new TermsRequiredError()

        const hashedPassword = await bcrypt.hash(randomToken(), BCRYPT_COST)

        const created = await this.authRepository.createUserWithGoogle({
          email,
          name: profile.name,
          picture: profile.picture,
          googleId: profile.sub,
          password: hashedPassword
        })

        user = {
          id: created.id,
          email,
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

  async loginWithDiscord(
    discordUser: {
      id: string
      email: string
      verified?: boolean
      username: string
      avatar: string | null
    },
    acceptedTerms: boolean
  ) {
    let user = await this.authRepository.findByDiscordId(discordUser.id)

    const profilePicture = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    if (!user) {
      if (!discordUser.email || discordUser.verified !== true) {
        throw new ClientError(UNVERIFIED_PROVIDER_EMAIL_MESSAGE, 403)
      }

      const email = normalizeEmail(discordUser.email)

      user = await this.authRepository.findByEmail(email)

      if (user) {
        if (user.discordId) {
          throw new ClientError(PROVIDER_ALREADY_LINKED_MESSAGE, 409)
        }

        const existingId = user.id
        const discardedPasswordHash = user.googleId
          ? null
          : await this.randomPasswordHash()

        if (discardedPasswordHash) {
          await markSessionsRevoked(this.cacheRepository, existingId)
        }

        user = await this.authRepository.linkDiscord(
          existingId,
          discordUser.id,
          profilePicture,
          discardedPasswordHash
        )

        if (discardedPasswordHash) {
          await this.markRevokedAfterLink(existingId)
        }
      } else {
        if (!acceptedTerms) throw new TermsRequiredError()

        const hashedPassword = await bcrypt.hash(
          crypto.randomUUID(),
          BCRYPT_COST
        )
        user = await this.authRepository.createWithDiscord({
          email,
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

  async validateUser(email: string, password: string, ip: string) {
    const ipFailuresKey = loginFailuresByIpKey(email, ip)
    const emailFailuresKey = loginFailuresByEmailKey(email)
    const familiarKey = familiarIpKey(email, ip)
    const [ipFailures, emailFailures, familiar] = await Promise.all([
      this.cacheRepository.get(ipFailuresKey),
      this.cacheRepository.get(emailFailuresKey),
      this.cacheRepository.get(familiarKey)
    ])
    const isFamiliarIp = familiar !== null
    if (
      hasReached(ipFailures, MAX_LOGIN_FAILURES_PER_IP) ||
      (!isFamiliarIp && hasReached(emailFailures, MAX_LOGIN_FAILURES_PER_EMAIL))
    ) {
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
      const ipCount = await this.cacheRepository.increment(
        ipFailuresKey,
        LOGIN_FAILURES_WINDOW_SECONDS
      )
      if (ipCount === MAX_LOGIN_FAILURES_PER_IP) {
        console.warn('[Login] blocked', { scope: 'ip' })
      }
      if (!isFamiliarIp) {
        const emailCount = await this.cacheRepository.increment(
          emailFailuresKey,
          LOGIN_FAILURES_WINDOW_SECONDS
        )
        if (emailCount === MAX_LOGIN_FAILURES_PER_EMAIL) {
          console.warn('[Login] blocked', { scope: 'email' })
        }
      }
      throw new ClientError('Email ou senha incorretos.')
    }

    await this.cacheRepository.del(ipFailuresKey)
    await this.cacheRepository.set(familiarKey, true, FAMILIAR_IP_TTL_SECONDS)
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

    const token = randomToken()

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

  async resetPassword(token: string, newPassword: string, ip: string) {
    const userId = (await this.cacheRepository.getdel(
      passwordResetKey(token)
    )) as string | null

    if (!userId) {
      throw new ClientError('Link de redefinição inválido ou expirado.', 400)
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST)
    const { email } = await this.authRepository.updatePassword(
      userId,
      hashedPassword
    )
    await this.authRepository.markEmailVerified(userId)
    await this.revokeAllSessions(userId)
    await Promise.all([
      this.cacheRepository.del(loginFailuresByEmailKey(email)),
      this.cacheRepository.del(loginFailuresByIpKey(email, ip))
    ])
  }

  async logout(refreshToken?: string, accessToken?: string) {
    if (refreshToken) {
      await this.authRepository.invalidateToken(refreshToken)
    }

    if (!accessToken) return

    let ttlSeconds: number
    try {
      const decoded = this.jwt.verify(accessToken) as { exp: number }
      ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000)
    } catch {
      return
    }

    if (ttlSeconds <= 0) return

    try {
      await this.cacheRepository.set(
        revokedAccessTokenKey(accessToken),
        true,
        ttlSeconds
      )
    } catch (error) {
      console.error('[Auth] access token revocation failed at logout', {
        error: error instanceof Error ? error.message : 'unknown error'
      })
    }
  }
}
