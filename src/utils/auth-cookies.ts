import { FastifyReply } from 'fastify'

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/'
} as const

export function setAccessTokenCookie(reply: FastifyReply, accessToken: string) {
  return reply.setCookie('accessToken', accessToken, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS
  })
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt?: Date
) {
  return setAccessTokenCookie(reply, accessToken).setCookie(
    'refreshToken',
    refreshToken,
    {
      ...BASE_COOKIE_OPTIONS,
      ...(refreshExpiresAt
        ? { expires: refreshExpiresAt }
        : { maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS })
    }
  )
}

export function clearAuthCookies(reply: FastifyReply) {
  return reply
    .clearCookie('accessToken', BASE_COOKIE_OPTIONS)
    .clearCookie('refreshToken', BASE_COOKIE_OPTIONS)
}
