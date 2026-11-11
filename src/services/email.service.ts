import nodemailer, { Transporter } from 'nodemailer'
import { EmailContent, renderEmail } from './email-template'

const DEFAULT_SMTP_HOST = 'smtp.gmail.com'
const DEFAULT_SMTP_PORT = 465
const SMTP_TIMEOUT_MS = 10_000

export class EmailService {
  private transporter: Transporter | null = null
  private fromAddress = ''

  private getTransporter() {
    if (this.transporter) return this.transporter

    const user = process.env.MAIL_USERNAME
    const pass = process.env.MAIL_PASSWORD
    if (!user || !pass) {
      throw new Error(
        'MAIL_USERNAME and MAIL_PASSWORD are required to send email.'
      )
    }

    const port = Number(process.env.MAIL_PORT) || DEFAULT_SMTP_PORT
    this.fromAddress = user
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || DEFAULT_SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS
    })
    return this.transporter
  }

  private async send(to: string, subject: string, content: EmailContent) {
    const transporter = this.getTransporter()
    await transporter.sendMail({
      from: {
        name: process.env.MAIL_FROM_NAME || 'EuZerei',
        address: this.fromAddress
      },
      to,
      subject,
      ...renderEmail(content)
    })
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    await this.send(to, 'Redefinir sua senha — EuZerei', {
      heading: 'Redefinir sua senha',
      intro: 'Recebemos um pedido para redefinir a senha da sua conta.',
      buttonLabel: 'Criar nova senha',
      url: resetUrl,
      footnote:
        'Se você não pediu isso, pode ignorar este email. O link expira em 1 hora.'
    })
  }

  async sendEmailVerificationEmail(to: string, verifyUrl: string) {
    await this.send(to, 'Confirme seu email — EuZerei', {
      heading: 'Confirme seu email',
      intro: 'Para confirmar que este email é seu, use o botão abaixo.',
      buttonLabel: 'Confirmar meu email',
      url: verifyUrl,
      footnote:
        'Se você não criou uma conta, pode ignorar este email. O link expira em 24 horas.'
    })
  }
}
