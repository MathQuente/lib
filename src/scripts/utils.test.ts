import { afterEach, describe, it, expect, vi } from 'vitest'
import { parseIdsArg, parseIntArg, parseStringArg } from './utils'

function withArgv(...args: string[]) {
  vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'script', ...args])
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('script argument helpers', () => {
  it('returns undefined when the flag is absent', () => {
    withArgv('--dry-run')

    expect(parseStringArg('--restore')).toBeUndefined()
    expect(parseIdsArg('--show')).toEqual([])
    expect(parseIntArg('--from')).toBeUndefined()
  })

  it('reads the value that follows the flag', () => {
    withArgv('--restore', 'backup.csv', '--show', '1,22', '--from', '5')

    expect(parseStringArg('--restore')).toBe('backup.csv')
    expect(parseIdsArg('--show')).toEqual([1, 22])
    expect(parseIntArg('--from')).toBe(5)
  })

  it.each([
    ['at the end', ['--restore']],
    ['followed by another flag', ['--restore', '--dry-run']]
  ])('throws instead of ignoring a flag with no value (%s)', (_label, args) => {
    withArgv(...args)

    expect(() => parseStringArg('--restore')).toThrow(/needs a value/)
  })

  it.each(['1,abc', '1,,2', '0', '-3', '1.5'])(
    'rejects an invalid id list %j',
    list => {
      withArgv('--show', list)

      expect(() => parseIdsArg('--show')).toThrow()
    }
  )
})
