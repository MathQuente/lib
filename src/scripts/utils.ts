export const BATCH_SIZE = 500
export const DELAY_MS = 300

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
