import sgMail from '@sendgrid/mail'

export class EmailService {
  private apiKeySet = false

  private getClient() {
    if (!this.apiKeySet) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? '')
      this.apiKeySet = true
    }
    return sgMail
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    await this.getClient().send({
      from: process.env.SENDGRID_FROM_EMAIL ?? '',
      to,
      subject: 'Redefinir sua senha — Zerei',
      html: `
        <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
        <p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p>
        <p>Se você não pediu isso, pode ignorar este email. O link expira em 1 hora.</p>
      `
    })
  }
}
