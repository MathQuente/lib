import {
  ACCOUNT_PLATFORM_LABEL,
  AccountPlatform,
  MAX_ACCOUNTS_PER_PLATFORM
} from '../utils/platform-accounts'

export class ClientError extends Error {
  public readonly statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export class AccountLimitError extends ClientError {
  constructor(platform: AccountPlatform) {
    super(
      `Você já vinculou o máximo de ${MAX_ACCOUNTS_PER_PLATFORM} contas ${ACCOUNT_PLATFORM_LABEL[platform]}.`,
      409
    )
  }
}
