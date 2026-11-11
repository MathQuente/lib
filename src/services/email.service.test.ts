import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn()
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) }
})

vi.mock('nodemailer', () => ({ default: { createTransport } }))

import { EmailService } from './email.service'

describe('EmailService', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({})
    createTransport.mockClear()
    vi.stubEnv('MAIL_USERNAME', 'euzerei.suporte@gmail.com')
    vi.stubEnv('MAIL_PASSWORD', 'app-password')
    vi.stubEnv('MAIL_HOST', '')
    vi.stubEnv('MAIL_PORT', '')
    vi.stubEnv('MAIL_FROM_NAME', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('connects to Gmail over SSL with short timeouts by default', async () => {
    await new EmailService().sendEmailVerificationEmail(
      'a@a.com',
      'https://x.test/verify'
    )

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'euzerei.suporte@gmail.com', pass: 'app-password' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000
    })
  })

  it('uses STARTTLS instead of SSL on any port other than 465', async () => {
    vi.stubEnv('MAIL_PORT', '587')

    await new EmailService().sendPasswordResetEmail(
      'a@a.com',
      'https://x.test/reset'
    )

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
        requireTLS: true
      })
    )
  })

  it('sends the verification email from the authenticated account with html and text', async () => {
    await new EmailService().sendEmailVerificationEmail(
      'a@a.com',
      'https://x.test/verify?token=1'
    )

    const message = sendMail.mock.calls[0][0]
    expect(message.from).toEqual({
      name: 'EuZerei',
      address: 'euzerei.suporte@gmail.com'
    })
    expect(message.to).toBe('a@a.com')
    expect(message.subject).toBe('Confirme seu email — EuZerei')
    expect(message.html).toContain('https://x.test/verify?token=1')
    expect(message.text).toContain('https://x.test/verify?token=1')
  })

  it('sends the password reset email with its own subject and expiry notice', async () => {
    await new EmailService().sendPasswordResetEmail(
      'a@a.com',
      'https://x.test/reset?token=2'
    )

    const message = sendMail.mock.calls[0][0]
    expect(message.subject).toBe('Redefinir sua senha — EuZerei')
    expect(message.html).toContain('expira em 1 hora')
    expect(message.text).toContain('https://x.test/reset?token=2')
  })

  it('uses the configured sender name', async () => {
    vi.stubEnv('MAIL_FROM_NAME', 'Suporte EuZerei')

    await new EmailService().sendPasswordResetEmail('a@a.com', 'https://x.test')

    expect(sendMail.mock.calls[0][0].from.name).toBe('Suporte EuZerei')
  })

  it('creates the transport only once', async () => {
    const service = new EmailService()

    await service.sendPasswordResetEmail('a@a.com', 'https://x.test/1')
    await service.sendPasswordResetEmail('b@b.com', 'https://x.test/2')

    expect(createTransport).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledTimes(2)
  })

  it('fails with a clear error when the credentials are missing', async () => {
    vi.stubEnv('MAIL_PASSWORD', '')

    await expect(
      new EmailService().sendPasswordResetEmail('a@a.com', 'https://x.test')
    ).rejects.toThrow('MAIL_USERNAME and MAIL_PASSWORD')
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('passes a delivery failure on to the caller', async () => {
    sendMail.mockRejectedValue(new Error('535 bad credentials'))

    await expect(
      new EmailService().sendPasswordResetEmail('a@a.com', 'https://x.test')
    ).rejects.toThrow('535')
  })
})
