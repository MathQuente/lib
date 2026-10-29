import { describe, it, expect, vi } from 'vitest'
import { FastifyReply, FastifyRequest } from 'fastify'
import { AuthController } from './auth.controller'
import { AuthService } from '../services/auth.service'
import { ClientError } from '../errors/client-error'

function fakeReply() {
  const reply = {
    status: vi.fn(() => reply),
    send: vi.fn(() => reply),
    header: vi.fn(() => reply),
    type: vi.fn(() => reply),
    setCookie: vi.fn(() => reply)
  }
  return reply as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>
    send: ReturnType<typeof vi.fn>
    header: ReturnType<typeof vi.fn>
    setCookie: ReturnType<typeof vi.fn>
  }
}

function setup(refreshTokens: ReturnType<typeof vi.fn>) {
  const controller = new AuthController({
    refreshTokens
  } as unknown as AuthService)
  const request = {
    cookies: { refreshToken: 'refresh-token' }
  } as unknown as FastifyRequest
  return { controller, request }
}

describe('AuthController.refreshTokenHandler', () => {
  it('answers 503 with status and message, without touching the cookies, when the refresh cannot be checked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { controller, request } = setup(
      vi.fn().mockRejectedValue(new Error('database down'))
    )
    const reply = fakeReply()

    await controller.refreshTokenHandler(request, reply)

    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.header).toHaveBeenCalledWith('Retry-After', '5')
    expect(reply.send).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 'unavailable',
      detail: 'Serviço indisponível no momento. Tente novamente em instantes.',
      message: 'Serviço indisponível no momento. Tente novamente em instantes.'
    })
    expect(reply.setCookie).not.toHaveBeenCalled()
  })

  it('rethrows a client error instead of answering 503', async () => {
    const error = new ClientError('Sessão inválida.', 401)
    const { controller, request } = setup(vi.fn().mockRejectedValue(error))

    await expect(
      controller.refreshTokenHandler(request, fakeReply())
    ).rejects.toBe(error)
  })
})
