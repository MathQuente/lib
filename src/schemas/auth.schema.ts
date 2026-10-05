import { z } from 'zod'
import { isCommonPassword } from '../utils/common-passwords'

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72

export const EmailSchema = z.string().trim().max(254).email()

export const PasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  )
  .refine(
    password => Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES,
    `A senha pode ter no máximo ${MAX_PASSWORD_BYTES} caracteres.`
  )
  .refine(
    password => !isCommonPassword(password),
    'Essa senha é muito comum. Escolha outra.'
  )

export const RegisterBodySchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema
  })
  .refine(
    ({ email, password }) => {
      const lowered = password.toLowerCase()
      const loweredEmail = email.toLowerCase()
      return lowered !== loweredEmail && lowered !== loweredEmail.split('@')[0]
    },
    { message: 'A senha não pode ser igual ao email.', path: ['password'] }
  )

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(1024)
})

export const ForgotPasswordBodySchema = z.object({
  email: EmailSchema
})

export const ResetTokenBodySchema = z.object({
  token: z.string().min(1).max(256)
})

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1).max(256),
  password: PasswordSchema
})
