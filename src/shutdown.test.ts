import { describe, it, expect, vi } from 'vitest'
import { shutdown } from './shutdown'

describe('shutdown', () => {
  it('closes the app, then the workers, then the connections', async () => {
    const order: string[] = []
    const step = (name: string) => async () => {
      order.push(name)
    }

    await shutdown({
      app: { close: step('app') },
      workers: [{ close: step('worker-1') }, { close: step('worker-2') }],
      connections: [step('database'), step('redis')]
    })

    expect(order.slice(0, 1)).toEqual(['app'])
    expect(order.slice(1, 3).sort()).toEqual(['worker-1', 'worker-2'])
    expect(order.slice(3).sort()).toEqual(['database', 'redis'])
  })

  it('waits for a running worker before closing the connections', async () => {
    const order: string[] = []
    let finishJob!: () => void
    const runningJob = new Promise<void>(resolve => {
      finishJob = resolve
    })

    const done = shutdown({
      app: { close: async () => {} },
      workers: [
        {
          close: async () => {
            await runningJob
            order.push('worker')
          }
        }
      ],
      connections: [
        async () => {
          order.push('database')
        }
      ]
    })

    await Promise.resolve()
    expect(order).toEqual([])
    finishJob()
    await done

    expect(order).toEqual(['worker', 'database'])
  })

  it('keeps closing the remaining steps when one fails', async () => {
    const closeRedis = vi.fn().mockResolvedValue(undefined)
    const closeWorker = vi.fn().mockResolvedValue(undefined)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    await shutdown({
      app: { close: vi.fn().mockRejectedValue(new Error('app')) },
      workers: [{ close: closeWorker }],
      connections: [
        vi.fn().mockRejectedValue(new Error('database')),
        closeRedis
      ]
    })

    expect(closeWorker).toHaveBeenCalled()
    expect(closeRedis).toHaveBeenCalled()
    expect(errors).toHaveBeenCalledTimes(2)
    errors.mockRestore()
  })
})
