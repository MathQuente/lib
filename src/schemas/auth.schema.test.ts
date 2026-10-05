import { describe, it, expect } from 'vitest'
import {
  LoginBodySchema,
  PasswordSchema,
  RegisterBodySchema
} from './auth.schema'

describe('PasswordSchema', () => {
  it.each([
    ['shorter than 8 characters', 'abc1234'],
    ['a common password', 'Password123'],
    ['longer than 72 bytes', 'a'.repeat(73)],
    ['72 characters that exceed 72 bytes', 'é'.repeat(40)]
  ])('rejects %s', (_name, password) => {
    expect(PasswordSchema.safeParse(password).success).toBe(false)
  })

  it.each([
    ['8 characters', 'k3!fPq9z'],
    ['a long passphrase without symbols', 'correct horse battery staple'],
    ['exactly 72 bytes', 'a'.repeat(72)]
  ])('accepts %s', (_name, password) => {
    expect(PasswordSchema.safeParse(password).success).toBe(true)
  })
})

describe('RegisterBodySchema', () => {
  it('rejects a password equal to the email or its local part', () => {
    expect(
      RegisterBodySchema.safeParse({
        email: 'someone99@a.com',
        password: 'Someone99@a.com'
      }).success
    ).toBe(false)
    expect(
      RegisterBodySchema.safeParse({
        email: 'longusername@a.com',
        password: 'longusername'
      }).success
    ).toBe(false)
  })

  it('trims the email and rejects one that is too long', () => {
    expect(
      RegisterBodySchema.parse({ email: ' a@a.com ', password: 'k3!fPq9z' })
        .email
    ).toBe('a@a.com')
    expect(
      RegisterBodySchema.safeParse({
        email: `${'a'.repeat(250)}@a.com`,
        password: 'k3!fPq9z'
      }).success
    ).toBe(false)
  })
})

describe('LoginBodySchema', () => {
  it('accepts a short password from an account created before the new policy', () => {
    expect(
      LoginBodySchema.safeParse({ email: 'a@a.com', password: '123456' })
        .success
    ).toBe(true)
  })
})
