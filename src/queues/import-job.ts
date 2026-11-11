import { Queue, UnrecoverableError } from 'bullmq'
import { ClientError } from '../errors/client-error'
import { TimeoutError } from '../utils/with-timeout'

export const IMPORT_COOLDOWN_MS = 60 * 60 * 1000

export const IMPORT_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'fixed', delay: 30_000 }
} as const

export function toImportJobError(err: unknown, genericMessage: string): Error {
  if (err instanceof ClientError) return new UnrecoverableError(err.message)
  if (err instanceof TimeoutError) return new UnrecoverableError(genericMessage)
  return new Error(genericMessage)
}

export interface ImportSectionResult {
  imported: number
  updated: number
  skipped: number
  notFound: string[]
  suggestions?: number
}

export async function enqueueUniqueImport(
  queue: Queue,
  jobId: string,
  data: { userId: string },
  platformLabel: string
) {
  const existing = await queue.getJob(jobId)

  if (existing) {
    const state = await existing.getState()
    if (state === 'waiting' || state === 'active' || state === 'delayed') {
      throw new ClientError(
        `Já existe uma importação da ${platformLabel} em andamento.`,
        409
      )
    }
    if (state === 'completed' && existing.finishedOn) {
      const remainingMs = existing.finishedOn + IMPORT_COOLDOWN_MS - Date.now()
      if (remainingMs > 0) {
        const remainingMinutes = Math.ceil(remainingMs / 60000)
        throw new ClientError(
          `Você pode importar novamente em ${remainingMinutes} minuto(s).`,
          429
        )
      }
    }
    await existing.remove()
  }

  await queue.add('import', data, { jobId, ...IMPORT_JOB_OPTIONS })
  return { status: 'queued' as const }
}

export async function getImportJobStatus<TResult>(queue: Queue, jobId: string) {
  const job = await queue.getJob(jobId)
  if (!job) return { status: 'idle' as const }

  const state = await job.getState()

  if (state === 'completed') {
    const cooldownUntil = job.finishedOn
      ? job.finishedOn + IMPORT_COOLDOWN_MS
      : undefined
    return {
      status: 'completed' as const,
      result: job.returnvalue as TResult,
      finishedAt: job.finishedOn,
      cooldownUntil:
        cooldownUntil && cooldownUntil > Date.now() ? cooldownUntil : undefined
    }
  }
  if (state === 'failed') {
    return { status: 'failed' as const, error: job.failedReason }
  }

  const progress = typeof job.progress === 'number' ? job.progress : undefined

  return { status: state as 'waiting' | 'active' | 'delayed', progress }
}
