/**
 * Seeded pseudo-random number generator (mulberry32).
 * Zero dependencies, works in Cloudflare Workers.
 */
export function createRNG(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pick random element from array */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Random integer in [min, max] inclusive */
export function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/** Log-normal sample via Box-Muller */
export function rlnorm(meanlog: number, sdlog: number, rng: () => number): number {
  const u1 = rng() || 1e-10
  const u2 = rng()
  return Math.exp(meanlog + sdlog * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2))
}

/** Sample from a weighted distribution */
export function sampleWeighted<T>(
  items: readonly T[],
  weights: readonly number[],
  rng: () => number
): T {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}
