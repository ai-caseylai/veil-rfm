/**
 * Customer Lifetime Value (CLV) using BTYD models.
 *
 * CLV = DERT × E(M) × margin
 *
 * DERT = Discounted Expected Residual Transactions
 *   Sum of expected future transactions discounted to present value.
 *
 * Combines:
 *   - Pareto/NBD for transaction count prediction
 *   - Gamma-Gamma for monetary value per transaction
 */

import {
  pnbdConditionalExpectedTransactions,
  pnbdPAlive,
  pnbdEstimateParams,
  pnbdLLSum,
} from "./pnbd"
import type { CBSRow } from "./pnbd"
import { gggExpectedSpend, gggEstimateParams } from "./ggg"
import type { SpendRow } from "./ggg"

// ── Types ──

export interface CLVInput {
  cbs: CBSRow[]
  spendData: SpendRow[]
  discountRate?: number   // annual discount rate (default 0.1 = 10%)
  margin?: number         // profit margin (default 1.0 = 100%)
  forecastPeriods?: number // number of periods to forecast (default 52 weeks)
  periodUnit?: "week" | "month" | "year"
}

export interface CLVResult {
  customerID: string
  pAlive: number
  expectedTransactions: number
  expectedSpendPerTxn: number
  lifetimeValue: number
  params: {
    pnbd: number[]
    ggg: number[]
  }
}

export interface CLVReport {
  params: {
    pnbd: number[]   // [r, alpha, s, beta]
    ggg: number[]    // [p, q, gamma]
  }
  customers: CLVResult[]
  summary: {
    totalCLV: number
    avgCLV: number
    totalPAlive: number
    activeCustomerCount: number
  }
}

// ── Discounted Expected Residual Transactions (DERT) ──

/**
 * Compute DERT for a single customer.
 * DERT = Σ_{t=1}^{T} E[X_t] / (1+d)^t
 * where d is the per-period discount rate.
 */
export function computeDERT(
  pnbdParams: number[],
  x: number,
  tx: number,
  Tcal: number,
  discountRate: number,
  nPeriods: number
): number {
  const periodDiscount = discountRate / nPeriods // per-period rate
  let dert = 0

  for (let t = 1; t <= nPeriods; t++) {
    const Tstar = t
    const expectedTxn = pnbdConditionalExpectedTransactions(
      pnbdParams, Tstar, x, tx, Tcal
    )
    // Incremental expected for period t
    const prevTstar = t - 1
    const prevExpected = prevTstar > 0
      ? pnbdConditionalExpectedTransactions(pnbdParams, prevTstar, x, tx, Tcal)
      : 0
    const incremental = Math.max(0, expectedTxn - prevExpected)
    dert += incremental / Math.pow(1 + periodDiscount, t)
  }

  return dert
}

// ── Full CLV calculation ──

/**
 * Compute Customer Lifetime Value for all customers.
 */
export function computeCLV(input: CLVInput): CLVReport {
  const {
    cbs,
    spendData,
    discountRate = 0.1,
    margin = 1.0,
    forecastPeriods = 52,
  } = input

  // Estimate Pareto/NBD parameters
  let pnbdParams: number[]
  let gggParams: number[]

  // For very small datasets (n < 10), use heuristic estimation
  const useHeuristic = cbs.length < 10

  if (useHeuristic) {
    pnbdParams = pnbdEstimateParams(cbs)
    gggParams = gggEstimateParams(spendData)
  } else {
    pnbdParams = pnbdEstimateParams(cbs)
    gggParams = gggEstimateParams(spendData)
  }

  // Compute per-customer CLV
  const spendMap = new Map(spendData.map((s) => [s.cust, s]))
  const customers: CLVResult[] = []

  for (const row of cbs) {
    const spend = spendMap.get(row.cust)
    const x = row.x
    const tx = row.tx
    const Tcal = row.Tcal

    // BTYD expected transactions
    let expectedTxn = pnbdConditionalExpectedTransactions(
      pnbdParams, forecastPeriods, x, tx, Tcal
    )

    // P(Alive)
    let pAlive = pnbdPAlive(pnbdParams, x, tx, Tcal)

    // Fallback for small datasets: use historical rate
    if (useHeuristic && (expectedTxn <= 0 || !isFinite(expectedTxn))) {
      const histRate = x / Math.max(1, Tcal)  // transactions per week
      expectedTxn = histRate * Math.min(forecastPeriods, 52) * (x > 0 ? 0.7 : 0.1)
      pAlive = x > 0 ? 0.5 + 0.1 * Math.min(x, 5) : 0.05
    }

    // Expected spend per transaction
    const mBar = spend?.m ?? 0
    let expectedSpend = spend
      ? gggExpectedSpend(gggParams, x, mBar)
      : 0

    // Always use observed average as the primary spend estimate
    // Gamma-Gamma theoretical value is only used when valid
    if (!isFinite(expectedSpend) || expectedSpend <= 0 || expectedSpend > mBar * 100) {
      expectedSpend = mBar
    }

    // DERT
    let dert = computeDERT(pnbdParams, x, tx, Tcal, discountRate, forecastPeriods)

    // Fallback DERT
    if (dert <= 0 || !isFinite(dert)) {
      dert = expectedTxn * 0.9 // simple discount
    }

    // CLV = DERT × E(Spend) × margin
    const clv = Math.max(0, dert * expectedSpend * margin)

    customers.push({
      customerID: row.cust,
      pAlive: Math.min(1, Math.max(0, pAlive)),
      expectedTransactions: Math.max(0, expectedTxn),
      expectedSpendPerTxn: Math.max(0, expectedSpend),
      lifetimeValue: clv,
      params: { pnbd: pnbdParams, ggg: gggParams },
    })
  }

  const totalCLV = customers.reduce((s, c) => s + c.lifetimeValue, 0)
  const totalPAlive = customers.reduce((s, c) => s + c.pAlive, 0)

  return {
    params: { pnbd: pnbdParams, ggg: gggParams },
    customers,
    summary: {
      totalCLV,
      avgCLV: customers.length > 0 ? totalCLV / customers.length : 0,
      totalPAlive,
      activeCustomerCount: customers.filter((c) => c.pAlive > 0.5).length,
    },
  }
}

// ── Helper: build CBS from transactions ──

import type { Transaction } from "../types"

export function buildCBS(transactions: Transaction[], endDate?: Date): CBSRow[] {
  const end = endDate ?? new Date()
  const custMap = new Map<string, { dates: Date[]; amounts: number[] }>()

  for (const t of transactions) {
    if (!t.Timestamp) continue
    const d = new Date(t.Timestamp)
    if (isNaN(d.getTime()) || d > end) continue
    const entry = custMap.get(t.MemberID) ?? { dates: [], amounts: [] }
    entry.dates.push(d)
    entry.amounts.push(t.NetPrice ?? t.TotalPrice ?? 0)
    custMap.set(t.MemberID, entry)
  }

  const cbs: CBSRow[] = []
  for (const [cust, data] of custMap) {
    const sorted = data.dates.sort((a, b) => a.getTime() - b.getTime())
    const firstDate = sorted[0]
    const lastDate = sorted[sorted.length - 1]
    const Tcal = Math.max(1, Math.ceil((end.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7))) // in weeks

    // x = number of repeat transactions (total - 1 for first)
    const x = Math.max(0, sorted.length - 1)

    // tx = time of last transaction in weeks from first transaction
    const tx = Math.max(0.001, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    // Ensure tx <= Tcal
    const adjTx = Math.min(tx, Tcal - 0.001)

    cbs.push({ cust, x, tx: adjTx > 0 ? adjTx : 0.001, Tcal })
  }

  return cbs
}

export function buildSpendData(transactions: Transaction[], endDate?: Date): SpendRow[] {
  const end = endDate ?? new Date()
  const custMap = new Map<string, { count: number; total: number }>()

  for (const t of transactions) {
    if (!t.Timestamp) continue
    const d = new Date(t.Timestamp)
    if (isNaN(d.getTime()) || d > end) continue
    const entry = custMap.get(t.MemberID) ?? { count: 0, total: 0 }
    entry.count++
    entry.total += t.NetPrice ?? t.TotalPrice ?? 0
    custMap.set(t.MemberID, entry)
  }

  const spendData: SpendRow[] = []
  for (const [cust, data] of custMap) {
    if (data.count > 0) {
      spendData.push({ cust, x: data.count, m: data.total / data.count })
    }
  }
  return spendData
}
