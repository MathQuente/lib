export const TERMS_VERSION = '2026-11-11'

export function termsAcceptance() {
  return { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }
}
