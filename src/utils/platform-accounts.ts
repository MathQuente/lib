import { Platform } from '@prisma/client'

export const MAX_ACCOUNTS_PER_PLATFORM = 2

export type AccountPlatform = Extract<
  Platform,
  'STEAM' | 'PLAYSTATION' | 'XBOX'
>

export const ACCOUNT_PLATFORM_LABEL: Record<AccountPlatform, string> = {
  XBOX: 'do Xbox',
  STEAM: 'da Steam',
  PLAYSTATION: 'da PlayStation'
}
