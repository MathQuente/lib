import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs'

export const BATCH_SIZE = 500
export const DELAY_MS = 300

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function parseIntArg(flag: string): number | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  const value = Number(process.argv[index + 1])
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`)
  }
  return value
}

const RETRY_ATTEMPTS = 5
const RETRY_DELAY_MS = 2000

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= RETRY_ATTEMPTS) throw err
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

export function parseStringArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} needs a value`)
  }
  return value
}

export function parseIdsArg(flag: string): number[] {
  const raw = parseStringArg(flag)
  if (raw === undefined) return []
  const ids = raw.split(',').map(Number)
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error(`${flag} must be a comma-separated list of positive ids`)
  }
  return ids
}

export function writeBackupFile(name: string, text: string): void {
  const fd = openSync(name, 'wx')
  try {
    writeSync(fd, text)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}
