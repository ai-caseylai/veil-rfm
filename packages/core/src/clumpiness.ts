/**
 * Inter-Event Time clumpiness metric.
 * Measures whether a customer's visits are evenly spaced (low clumpiness)
 * or clustered together (high clumpiness).
 *
 * Port of clumpiness.R::clumpiness()
 */
export function clumpiness(nx: number[]): number {
  // nx = normalized inter-event times: x / (N+1)
  const sumLogX = nx.reduce((s, x) => s + Math.log(x), 0)
  return 1 + (sumLogX * nx.reduce((s, x) => s + x, 0)) / Math.log(nx.length)
}

/**
 * Compute inter-event times from transaction timestamps.
 * Port of clumpiness.R::computeIET() and elog2iet()
 */
export function computeIET(
  timestamps: Date[],
  N: number
): number[] {
  if (timestamps.length < 2) return [1]

  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime())
  const startTime = sorted[0].getTime()
  const endTime = sorted[sorted.length - 1].getTime()

  const totalPeriods = N + 1
  const periodMs = (endTime - startTime) / totalPeriods

  const normTimes = sorted.map(
    (t) => (t.getTime() - startTime) / periodMs
  )

  // Compute inter-event times (diff of normalized times)
  const iet: number[] = [normTimes[0]] // first event time
  for (let i = 1; i < normTimes.length; i++) {
    const diff = normTimes[i] - normTimes[i - 1]
    if (diff > 0) iet.push(diff)
  }
  // Last chunk: N+1 - last_t
  iet.push(totalPeriods - normTimes[normTimes.length - 1])

  // Normalize: nx = x / (N+1)
  return iet.map((x) => x / totalPeriods)
}

/**
 * Compute clumpiness for a single customer.
 */
export function customerClumpiness(
  timestamps: Date[],
  N: number
): number {
  const iet = computeIET(timestamps, N)
  return clumpiness(iet)
}
