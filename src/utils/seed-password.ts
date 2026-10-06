import crypto from 'node:crypto'

const MIN_SEED_PASSWORD_LENGTH = 8

export function getSeedPassword(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeds must not run with NODE_ENV=production')
  }

  const configured = process.env.SEED_USER_PASSWORD
  if (configured) {
    if (configured.length < MIN_SEED_PASSWORD_LENGTH) {
      throw new Error(
        `SEED_USER_PASSWORD must have at least ${MIN_SEED_PASSWORD_LENGTH} characters`
      )
    }
    return configured
  }

  const generated = crypto.randomBytes(12).toString('base64url')
  console.log(
    `SEED_USER_PASSWORD is not set. Password generated for seeded users: ${generated}`
  )
  return generated
}
