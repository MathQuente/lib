import { describe, it, expect } from 'vitest'
import { escapeHtml, renderEmail } from './email-template'

const content = {
  heading: 'Confirme seu email',
  intro: 'Use o botão abaixo.',
  buttonLabel: 'Confirmar meu email',
  url: 'https://euzerei.app/verify-email?token=abc&next=/home',
  footnote: 'O link expira em 24 horas.'
}

describe('escapeHtml', () => {
  it('escapes the characters that can break out of text or an attribute', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    )
  })
})

describe('renderEmail', () => {
  it('renders the heading, the intro, the footnote and a button that points to the url', () => {
    const { html } = renderEmail(content)

    expect(html).toContain('Confirme seu email')
    expect(html).toContain('Use o botão abaixo.')
    expect(html).toContain('O link expira em 24 horas.')
    expect(html).toContain(
      'href="https://euzerei.app/verify-email?token=abc&amp;next=/home"'
    )
    expect(html).toContain('>Confirmar meu email</a>')
  })

  it('shows the link as text too, for clients that block the button', () => {
    const { html } = renderEmail(content)

    expect(html.match(/token=abc&amp;next=\/home/g)).toHaveLength(3)
  })

  it('escapes the content it is given', () => {
    const { html } = renderEmail({
      ...content,
      heading: '<script>alert(1)</script>',
      url: 'https://x.test/?a="b"'
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a=&quot;b&quot;')
  })

  it('builds a plain text version with the raw url and no tags', () => {
    const { text } = renderEmail(content)

    expect(text).toContain(
      'Confirmar meu email: https://euzerei.app/verify-email?token=abc&next=/home'
    )
    expect(text).toContain('O link expira em 24 horas.')
    expect(text).not.toMatch(/<[a-z/]/i)
  })
})
