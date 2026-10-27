import { describe, it, expect } from 'vitest'
import {
  ForgotPasswordBodySchema,
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
        password: 'Someone99@a.com',
        acceptedTerms: true
      }).success
    ).toBe(false)
    expect(
      RegisterBodySchema.safeParse({
        email: 'longusername@a.com',
        password: 'longusername',
        acceptedTerms: true
      }).success
    ).toBe(false)
  })

  it('lowercases the email on signup, login and password reset', () => {
    expect(
      RegisterBodySchema.parse({
        email: 'Ana@Mail.COM',
        password: 'k3!fPq9z',
        acceptedTerms: true
      })
        .email
    ).toBe('ana@mail.com')
    expect(
      LoginBodySchema.parse({ email: ' Ana@Mail.COM ', password: 'x' }).email
    ).toBe('ana@mail.com')
    expect(
      ForgotPasswordBodySchema.parse({ email: 'Ana@Mail.COM' }).email
    ).toBe('ana@mail.com')
  })

  it('trims the email and rejects one that is too long', () => {
    expect(
      RegisterBodySchema.parse({
        email: ' a@a.com ',
        password: 'k3!fPq9z',
        acceptedTerms: true
      })
        .email
    ).toBe('a@a.com')
    expect(
      RegisterBodySchema.safeParse({
        email: `${'a'.repeat(250)}@a.com`,
        password: 'k3!fPq9z',
        acceptedTerms: true
      }).success
    ).toBe(false)
  })
})

describe('RegisterBodySchema terms acceptance', () => {
  const valid = { email: 'ana@mail.com', password: 'k3!fPq9z' }

  it('accepts the sign-up when the terms were accepted', () => {
    expect(
      RegisterBodySchema.safeParse({ ...valid, acceptedTerms: true }).success
    ).toBe(true)
  })

  it.each([
    ['missing', undefined],
    ['false', false],
    ['the string "true"', 'true']
  ])('rejects the sign-up when acceptedTerms is %s', (_name, acceptedTerms) => {
    const result = RegisterBodySchema.safeParse({ ...valid, acceptedTerms })

    expect(result.success).toBe(false)
    expect(
      result.success ? [] : result.error.issues.map(issue => issue.message)
    ).toEqual(['Confirme que tem 18 anos ou mais e aceita os Termos.'])
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
