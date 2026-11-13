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
