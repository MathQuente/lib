import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '../database/prisma-client'
import { AccountLimitError } from '../errors/client-error'
import { linkPlatformAccount } from './platform-account-link'

const TAKEN = 'Esta conta já está vinculada a outro usuário.'

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findAccount: vi.fn().mockResolvedValue(null),
    listAccounts: vi.fn().mockResolvedValue([]),
    addAccount: vi.fn().mockResolvedValue({ id: 'new', displayName: 'Name' }),
    updateAccountName: vi.fn().mockResolvedValue(null),
    ...overrides
  } as never as Parameters<typeof linkPlatformAccount>[0] & {
    findAccount: ReturnType<typeof vi.fn>
    listAccounts: ReturnType<typeof vi.fn>
    addAccount: ReturnType<typeof vi.fn>
    updateAccountName: ReturnType<typeof vi.fn>
  }
}

function link(
  repo: ReturnType<typeof repository>,
  resolveName: () => Promise<string | null> = async () => 'Name'
) {
  return linkPlatformAccount(repo, {
    userId: 'user-1',
    platform: 'STEAM',
    externalId: 'ext-1',
    takenMessage: TAKEN,
    resolveName
  })
}

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test'
  })

describe('linkPlatformAccount', () => {
  it('adds a new account named by resolveName, capped at two per platform', async () => {
    const repo = repository()

    await link(repo)

    expect(repo.addAccount).toHaveBeenCalledWith(
      'user-1',
      'STEAM',
      { externalId: 'ext-1', displayName: 'Name' },
      2
    )
  })

  it('falls back to the external id when the name cannot be resolved', async () => {
    const repo = repository()

    await link(repo, async () => null)

    expect(repo.addAccount).toHaveBeenCalledWith(
      'user-1',
      'STEAM',
      { externalId: 'ext-1', displayName: 'ext-1' },
      2
    )
  })

  it('refreshes the name of an account the user already has when it changed', async () => {
    const repo = repository({
      findAccount: vi.fn().mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        displayName: 'Old'
      })
    })

    await link(repo)

    expect(repo.updateAccountName).toHaveBeenCalledWith('acc-1', 'Name')
    expect(repo.addAccount).not.toHaveBeenCalled()
  })

  it('leaves the stored name alone when it did not change or could not be resolved', async () => {
    const repo = repository({
      findAccount: vi.fn().mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        displayName: 'Name'
      })
    })

    await link(repo)
    await link(repo, async () => null)

    expect(repo.updateAccountName).not.toHaveBeenCalled()
  })

  it('answers 409 when the account belongs to another user', async () => {
    const repo = repository({
      findAccount: vi
        .fn()
        .mockResolvedValue({ id: 'x', userId: 'user-2', displayName: 'X' })
    })

    await expect(link(repo)).rejects.toMatchObject({
      statusCode: 409,
      message: TAKEN
    })
    expect(repo.addAccount).not.toHaveBeenCalled()
  })

  it('refuses a third account without resolving the name', async () => {
    const resolveName = vi.fn()
    const repo = repository({
      listAccounts: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    })

    await expect(link(repo, resolveName)).rejects.toBeInstanceOf(
      AccountLimitError
    )
    expect(resolveName).not.toHaveBeenCalled()
    expect(repo.addAccount).not.toHaveBeenCalled()
  })

  it('refuses the account when a concurrent link took the last slot', async () => {
    const repo = repository({ addAccount: vi.fn().mockResolvedValue(null) })

    await expect(link(repo)).rejects.toBeInstanceOf(AccountLimitError)
  })

  it('treats a lost race to the same user as already linked', async () => {
    const repo = repository({
      addAccount: vi.fn().mockRejectedValue(duplicate()),
      findAccount: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'acc-1',
        userId: 'user-1',
        displayName: 'Name'
      })
    })

    await expect(link(repo)).resolves.toBeUndefined()
  })

  it('answers 409 when the race was won by another user', async () => {
    const repo = repository({
      addAccount: vi.fn().mockRejectedValue(duplicate()),
      findAccount: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'x', userId: 'user-2', displayName: 'X' })
    })

    await expect(link(repo)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not hide an unexpected database error', async () => {
    const repo = repository({
      addAccount: vi.fn().mockRejectedValue(new Error('db down'))
    })

    await expect(link(repo)).rejects.toThrow('db down')
  })

  it('scopes the lookups to the platform', async () => {
    const repo = repository()

    await linkPlatformAccount(repo, {
      userId: 'user-1',
      platform: 'PLAYSTATION',
      externalId: 'ext-1',
      takenMessage: TAKEN,
      resolveName: async () => 'Name'
    })

    expect(repo.findAccount).toHaveBeenCalledWith('PLAYSTATION', 'ext-1')
    expect(repo.listAccounts).toHaveBeenCalledWith('user-1', 'PLAYSTATION')
  })
})
