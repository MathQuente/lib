export function createRng(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const between = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1))

  const chance = (probability: number) => next() < probability

  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]

  const weightedIndex = (weights: readonly number[]) => {
    const total = weights.reduce((sum, w) => sum + w, 0)
    let cursor = next() * total
    for (let i = 0; i < weights.length; i++) {
      cursor -= weights[i]
      if (cursor < 0) return i
    }
    return weights.length - 1
  }

  const weightedPick = <T>(items: readonly T[], weights: readonly number[]): T =>
    items[weightedIndex(weights)]

  const weightedSample = <T>(
    items: readonly T[],
    weights: readonly number[],
    count: number
  ): T[] => {
    const pool = items.map((item, i) => ({ item, weight: weights[i] }))
    const picked: T[] = []
    while (picked.length < count && pool.length > 0) {
      const index = weightedIndex(pool.map(p => p.weight))
      picked.push(pool[index].item)
      pool.splice(index, 1)
    }
    return picked
  }

  const logNormal = (median: number, spread: number) => {
    const u1 = Math.max(next(), 1e-9)
    const u2 = next()
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return median * Math.exp(normal * spread)
  }

  return { next, between, chance, pick, weightedPick, weightedSample, logNormal }
}

export type Rng = ReturnType<typeof createRng>
