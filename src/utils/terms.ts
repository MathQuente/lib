export const TERMS_VERSION = '2026-10-25'

export function termsAcceptance() {
  return { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }
}
