import crypto from 'node:crypto'
import { FastifyReply, FastifyRequest } from 'fastify'
import { SteamService } from '../services/steam.service'
import { SteamApiService } from '../services/steam-api.service'
import { CacheRepository } from '../repositories/cache.repository'
import { ClientError } from '../errors/client-error'

const STEAM_LINK_STATE_TTL_SECONDS = 600
const steamLinkStateKey = (state: string) => `steam-link-state:${state}`

export class SteamController {
  constructor(
    private steamService: SteamService,
    private cacheRepository: CacheRepository = new CacheRepository()
  ) {}

  private getReturnUrl(state: string) {
    const baseUrl = process.env.STEAM_OPENID_RETURN_URL
    if (!baseUrl) {
      console.error('[Steam] STEAM_OPENID_RETURN_URL is not configured')
      throw new ClientError('Vínculo com a Steam indisponível no momento.', 503)
    }
    return `${baseUrl}?state=${state}`
  }

  private redirectToLibrary(reply: FastifyReply, result: string) {
    return reply.redirect(
      `${process.env.FRONTEND_URL}/userLibrary?steam=${result}`
    )
  }

  async startLink(request: FastifyRequest, reply: FastifyReply) {
    const state = crypto.randomBytes(16).toString('hex')
    const returnUrl = this.getReturnUrl(state)

    await this.cacheRepository.set(
      steamLinkStateKey(state),
      request.user.userId,
      STEAM_LINK_STATE_TTL_SECONDS
    )

    return reply
      .status(200)
      .send({ url: SteamApiService.buildOpenIdLoginUrl(returnUrl) })
  }

  async linkCallback(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as Record<string, unknown>
    const state = typeof query.state === 'string' ? query.state : ''

    try {
      if (!/^[a-f0-9]{32}$/.test(state)) {
        return this.redirectToLibrary(reply, 'failed')
      }

      const stateOwner = await this.cacheRepository.get(
        steamLinkStateKey(state)
      )
      await this.cacheRepository.del(steamLinkStateKey(state))
      if (stateOwner !== request.user.userId) {
        return this.redirectToLibrary(reply, 'failed')
      }

      const steamId = await SteamApiService.verifyOpenIdAssertion(
        query,
        this.getReturnUrl(state)
      )
      if (!steamId) return this.redirectToLibrary(reply, 'failed')

      await this.steamService.connectSteam(request.user.userId, steamId)
      return this.redirectToLibrary(reply, 'connected')
    } catch (err) {
      if (err instanceof ClientError && err.statusCode === 409) {
        return this.redirectToLibrary(reply, 'taken')
      }
      console.error('[Steam] link callback failed', {
        error: err instanceof Error ? err.message : 'unknown error'
      })
      return this.redirectToLibrary(reply, 'failed')
    }
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    await this.steamService.disconnectSteam(userId)

    return reply.status(204).send()
  }

  async startImport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.steamService.enqueueImport(userId)

    return reply.status(202).send(result)
  }

  async getImportStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId

    const result = await this.steamService.getImportStatus(userId)

    return reply.status(200).send(result)
  }
}
