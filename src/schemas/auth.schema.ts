import { z } from 'zod'

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email()
})

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'Password required at least 6 characters.')
})
