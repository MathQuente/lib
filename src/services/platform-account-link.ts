import { AccountLimitError, ClientError } from '../errors/client-error'
import { UserRepository } from '../repositories/users.repository'
import { isUniqueViolation } from '../utils/prisma-errors'
import {
  AccountPlatform,
  MAX_ACCOUNTS_PER_PLATFORM
} from '../utils/platform-accounts'

type AccountRepository = Pick<
  UserRepository,
  'findAccount' | 'listAccounts' | 'addAccount' | 'updateAccountName'
>

export interface LinkPlatformAccountInput {
  userId: string
  platform: AccountPlatform
  externalId: string
  takenMessage: string
  resolveName: () => Promise<string | null>
}

export async function linkPlatformAccount(
  repository: AccountRepository,
  {
    userId,
    platform,
    externalId,
    takenMessage,
    resolveName
  }: LinkPlatformAccountInput
) {
  const existing = await repository.findAccount(platform, externalId)
  if (existing) {
    if (existing.userId !== userId) throw new ClientError(takenMessage, 409)
    const name = await resolveName()
    if (name && name !== existing.displayName) {
      await repository.updateAccountName(existing.id, name)
    }
    return
  }

  const accounts = await repository.listAccounts(userId, platform)
  if (accounts.length >= MAX_ACCOUNTS_PER_PLATFORM) {
    throw new AccountLimitError(platform)
  }

  const displayName = (await resolveName()) ?? externalId
  try {
    const created = await repository.addAccount(
      userId,
      platform,
      { externalId, displayName },
      MAX_ACCOUNTS_PER_PLATFORM
    )
    if (!created) throw new AccountLimitError(platform)
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const winner = await repository.findAccount(platform, externalId)
    if (winner?.userId !== userId) throw new ClientError(takenMessage, 409)
  }
}
