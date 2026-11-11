import { describe, it, expect, vi } from 'vitest'
import type { Queue } from 'bullmq'
import { UnrecoverableError } from 'bullmq'
import { ClientError } from '../errors/client-error'
import { TimeoutError } from '../utils/with-timeout'
import {
  getImportJobStatus,
  IMPORT_COOLDOWN_MS,
  IMPORT_JOB_OPTIONS,
  toImportJobError
} from './import-job'

function queueWith(job: unknown) {
  return { getJob: vi.fn().mockResolvedValue(job) } as unknown as Queue
}

describe('getImportJobStatus', () => {
  it('reports idle when there is no job', async () => {
    expect(await getImportJobStatus(queueWith(undefined), 'job-1')).toEqual({
      status: 'idle'
    })
  })

  it('returns the result, when it finished and the cooldown of a completed job', async () => {
    const finishedOn = Date.now() - 10 * 60 * 1000
    const result = { library: { imported: 3 } }
    const status = await getImportJobStatus(
      queueWith({
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: result,
        finishedOn
      }),
      'job-1'
    )

    expect(status).toEqual({
      status: 'completed',
      result,
      finishedAt: finishedOn,
      cooldownUntil: finishedOn + IMPORT_COOLDOWN_MS
    })
  })

  it('keeps finishedAt but drops the cooldown once it has passed', async () => {
    const finishedOn = Date.now() - IMPORT_COOLDOWN_MS - 1000
    const status = await getImportJobStatus(
      queueWith({
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: {},
        finishedOn
      }),
      'job-1'
    )

    expect(status).toMatchObject({
      status: 'completed',
      finishedAt: finishedOn
    })
    expect(status).toHaveProperty('cooldownUntil', undefined)
  })

  it('returns the reason of a failed job', async () => {
    const status = await getImportJobStatus(
      queueWith({
        getState: vi.fn().mockResolvedValue('failed'),
        failedReason: 'Steam did not answer'
      }),
      'job-1'
    )

    expect(status).toEqual({ status: 'failed', error: 'Steam did not answer' })
  })

  it('returns the progress of a running job', async () => {
    const status = await getImportJobStatus(
      queueWith({
        getState: vi.fn().mockResolvedValue('active'),
        progress: 42
      }),
      'job-1'
    )

    expect(status).toEqual({ status: 'active', progress: 42 })
  })
})

describe('toImportJobError', () => {
  it('keeps the message of a ClientError and stops the retries', () => {
    const error = toImportJobError(
      new ClientError('Perfil privado.'),
      'generic'
    )

    expect(error).toBeInstanceOf(UnrecoverableError)
    expect(error.message).toBe('Perfil privado.')
  })

  it('does not retry a timeout, because the import may still be running', () => {
    const error = toImportJobError(new TimeoutError('timed out'), 'generic')

    expect(error).toBeInstanceOf(UnrecoverableError)
    expect(error.message).toBe('generic')
  })

  it('lets any other failure be retried with the generic message', () => {
    const error = toImportJobError(new Error('socket hang up'), 'generic')

    expect(error).not.toBeInstanceOf(UnrecoverableError)
    expect(error.message).toBe('generic')
  })

  it('retries once after a pause', () => {
    expect(IMPORT_JOB_OPTIONS.attempts).toBe(2)
    expect(IMPORT_JOB_OPTIONS.backoff.delay).toBeGreaterThan(0)
  })
})
