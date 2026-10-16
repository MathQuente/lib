import { describe, it, expect, vi } from 'vitest'
import type { Queue } from 'bullmq'
import { getImportJobStatus, IMPORT_COOLDOWN_MS } from './import-job'

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
