type Closable = { close: () => Promise<unknown> }

type ShutdownTargets = {
  app: Closable
  workers: Closable[]
  connections: Array<() => Promise<unknown>>
}

async function settle(label: string, steps: Array<() => Promise<unknown>>) {
  const results = await Promise.allSettled(steps.map(step => step()))
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`Shutdown failed (${label}):`, {
        error:
          result.reason instanceof Error ? result.reason.message : 'unknown'
      })
    }
  }
}

export async function shutdown({ app, workers, connections }: ShutdownTargets) {
  await settle('app', [() => app.close()])
  await settle(
    'workers',
    workers.map(worker => () => worker.close())
  )
  await settle('connections', connections)
}
