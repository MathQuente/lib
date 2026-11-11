export interface EmailContent {
  heading: string
  intro: string
  buttonLabel: string
  url: string
  footnote: string
}

const BRAND_COLOR = '#7c3aed'
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderEmail({
  heading,
  intro,
  buttonLabel,
  url,
  footnote
}: EmailContent) {
  const safeUrl = escapeHtml(url)

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#14141f;padding:24px 32px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:#ffffff;">
                Eu<span style="color:#a78bfa;">Zerei</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:${FONT_STACK};color:#1f2937;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#374151;">${escapeHtml(intro)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background-color:${BRAND_COLOR};border-radius:8px;">
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(buttonLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:${BRAND_COLOR};">${safeUrl}</a></p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(footnote)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#9ca3af;">
                Você recebeu este email porque ele foi usado no EuZerei. Não responda a esta mensagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    heading,
    '',
    intro,
    '',
    `${buttonLabel}: ${url}`,
    '',
    footnote,
    '',
    'Você recebeu este email porque ele foi usado no EuZerei. Não responda a esta mensagem.'
  ].join('\n')

  return { html, text }
}
