export class ClientError extends Error {
  public readonly statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export class XboxAccountLimitError extends ClientError {
  constructor(limit: number) {
    super(`Você já vinculou o máximo de ${limit} contas do Xbox.`, 409)
  }
}
