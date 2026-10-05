import crypto from 'node:crypto'
import { FastifyReply, FastifyRequest } from 'fastify'
import { XboxService } from '../services/xbox.service'
import { XboxAuthError, XboxAuthService } from '../services/xbox-auth.service'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'

const XBOX_LINK_STATE_TTL_SECONDS = 600
const xboxLinkStateKey = (state: string) => `xbox-link-state:${state}`

export class XboxController {
  constructor(
    private xboxService: XboxService,
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  private redirectToLibrary(reply: FastifyReply, result: string) {
    return reply.redirect(
      `${process.env.FRONTEND_URL}/userLibrary?xbox=${result}`
    )
  }

  async startLink(request: FastifyRequest, reply: FastifyReply) {
    const state = crypto.randomBytes(16).toString('hex')

    let url: string
    try {
      url = XboxAuthService.buildAuthorizeUrl(state)
    } catch (err) {
      console.error('[Xbox] link is not configured', {
        error: err instanceof Error ? err.message : 'unknown error'
      })
      throw new ClientError('Vínculo com o Xbox indisponível no momento.', 503)
    }

    await this.cacheRepository.set(
      xboxLinkStateKey(state),
      request.user.userId,
      XBOX_LINK_STATE_TTL_SECONDS
    )

    return reply.status(200).send({ url })
  }

  async linkCallback(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as Record<string, unknown>
    const state = typeof query.state === 'string' ? query.state : ''
    const code = typeof query.code === 'string' ? query.code : ''

    try {
      if (!/^[a-f0-9]{32}$/.test(state)) {
        return this.redirectToLibrary(reply, 'failed')
      }

      const stateOwner = await this.cacheRepository.get(xboxLinkStateKey(state))
      await this.cacheRepository.del(xboxLinkStateKey(state))
      if (stateOwner !== request.user.userId) {
        console.error('[Xbox] link callback state does not match the session')
        return this.redirectToLibrary(reply, 'failed')
      }
      if (!code) {
        const providerError = String(query.error ?? 'missing code')
          .replace(/[^a-z_ ]/gi, '')
          .slice(0, 60)
        console.error('[Xbox] sign-in returned no code', {
          error: providerError
        })
        return this.redirectToLibrary(reply, 'failed')
      }

      const profile = await XboxAuthService.getProfileFromCode(code)
      await this.xboxService.connectXbox(request.user.userId, profile)
      return this.redirectToLibrary(reply, 'connected')
    } catch (err) {
      if (err instanceof ClientError && err.statusCode === 409) {
        return this.redirectToLibrary(reply, 'taken')
      }
      if (err instanceof XboxAuthError && err.reason === 'no_profile') {
        return this.redirectToLibrary(reply, 'no_profile')
      }
      console.error('[Xbox] link callback failed', {
        error: err instanceof Error ? err.message : 'unknown error'
      })
      return this.redirectToLibrary(reply, 'failed')
    }
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    await this.xboxService.disconnectXbox(userId)

    return reply.status(204).send()
  }

  async startImport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.xboxService.enqueueImport(userId)

    return reply.status(202).send(result)
  }

  async getImportStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.xboxService.getImportStatus(userId)

    return reply.status(200).send(result)
  }
}
