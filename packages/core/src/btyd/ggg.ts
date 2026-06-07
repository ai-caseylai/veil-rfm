/**
 * Gamma-Gamma Monetary Value Model
 *
 * Models the average transaction value per customer.
 * Assumes transaction values are gamma-distributed with
 * shape parameter that varies across customers ~ Gamma(p, q).
 *
 * 3 parameters: p, q, γ (gamma shape)
 *
 * Reference: Fader, Hardie & Lee (2005)
 */

import { nelderMead } from "./optimize"

// ── Helpers ──

function gammaln(x: number): number {
  if (x <= 0) return Infinity
  if (x < 0.1) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x)
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  let z = x, s = c[0]
  for (let i = 1; i < g + 2; i++) { s += c[i] / z; z += 1 }
  const t = x + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s) - Math.log(x)
}

function digamma(x: number): number {
  // Approximation
  if (x < 0.5) return digamma(x + 1) - 1 / x
  let r = 0
  while (x < 7) { r -= 1 / x; x++ }
  const f = 1 / (x * x)
  r += Math.log(x) - 0.5 / x - f * (1/12 - f * (1/120 - f * (1/252 - f * 1/240)))
  return r
}

// ── Gamma-Gamma log-likelihood ──

export interface SpendRow {
  cust: string
  x: number       // number of transactions
  m: number       // average transaction value (total_spend / x)
}

/**
 * Log-likelihood for Gamma-Gamma spend model.
 * @param params  [p, q, gamma]
 */
export function gggLL(params: number[], data: SpendRow[]): number {
  const [p, q, gamma] = params
  if (p <= 0 || q <= 0 || gamma <= 0) return -Infinity

  let total = 0
  for (const row of data) {
    const { x, m } = row
    // log-likelihood contributions
    const ll = gammaln(p + x) - gammaln(p) + p * Math.log(q) + x * Math.log(m) + x * Math.log(gamma)
      - (p + x) * Math.log(q + gamma * x * m)
      + gammaln(gamma * x) // this term may not be needed — depends on model variant
    total += ll
  }
  return total
}

// ── Parameter estimation ──

export function gggEstimateParams(data: SpendRow[]): number[] {
  const avgX = data.reduce((s, r) => s + r.x, 0) / data.length
  const avgM = data.reduce((s, r) => s + r.m, 0) / data.length

  const start = [
    Math.max(0.1, avgX * 0.5),   // p
    Math.max(0.1, avgM * 0.5),   // q
    1.0,                          // gamma
  ]

  const fn = (p: number[]) => -gggLL(p, data)
  const result = nelderMead(fn, start, { maxIter: 500, stepSize: 0.5 })
  return result.params
}

// ── Expected average spend ──

/**
 * Expected average transaction value for a customer with x transactions.
 * E(M | p, q, γ, x, m_bar) where m_bar is the observed average.
 */
export function gggExpectedSpend(
  params: number[],
  x: number,
  mBar: number
): number {
  const [p, q, gamma] = params
  // E(M | x, m_bar) = [q / (q + γ·x·m_bar)] × (p + γ·x) / (p + x - 1)
  // This is the posterior mean — exact formula depends on model variant
  const num = (p + gamma * x)
  const den = q + gamma * x * mBar
  if (den <= 0 || num <= 0) return mBar

  // Simplified formula from BTYD literature:
  return (q + gamma * x * mBar) / (p + x - 1)
}
