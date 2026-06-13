import type { D1Database } from "@cloudflare/workers-types"

export interface CustomerRow {
  CustomerID: string
  Segment: string
  RecencyScore: number
  FrequencyScore: number
  MonetaryScore: number
  DaySinceLastTxn: number
  NoOfTxn: number
  TotalSpending: number
  AvgOrderValue: number
}

export interface SegmentRow {
  Segment: string
  "Number of Customers": number
}

export interface AvgStatRow {
  Segment: string
  value: number
}

export async function getCustomer(db: D1Database, id: string): Promise<CustomerRow | null> {
  const { results } = await db.prepare("SELECT * FROM customers WHERE CustomerID = ?").bind(id).run()
  return (results[0] as CustomerRow) ?? null
}

export async function searchCustomers(
  db: D1Database,
  opts: { segment?: string; search?: string; limit?: number },
): Promise<CustomerRow[]> {
  let sql = "SELECT * FROM customers WHERE 1=1"
  const params: unknown[] = []
  if (opts.segment) { sql += " AND Segment = ?"; params.push(opts.segment) }
  if (opts.search) { sql += " AND CustomerID LIKE ?"; params.push(`%${opts.search}%`) }
  sql += ` ORDER BY TotalSpending DESC LIMIT ${opts.limit ?? 50}`
  const { results } = await db.prepare(sql).bind(...params).run()
  return results as CustomerRow[]
}

export async function getSegmentDistribution(db: D1Database): Promise<SegmentRow[]> {
  const { results } = await db
    .prepare("SELECT Segment, COUNT(*) AS \"Number of Customers\" FROM customers GROUP BY Segment ORDER BY \"Number of Customers\" DESC")
    .run()
  return results as SegmentRow[]
}

export async function getAvgRecency(db: D1Database): Promise<AvgStatRow[]> {
  const { results } = await db
    .prepare("SELECT Segment, ROUND(AVG(DaySinceLastTxn)) AS value FROM customers GROUP BY Segment")
    .run()
  return results as AvgStatRow[]
}

export async function getAvgFrequency(db: D1Database): Promise<AvgStatRow[]> {
  const { results } = await db
    .prepare("SELECT Segment, ROUND(AVG(NoOfTxn)) AS value FROM customers GROUP BY Segment")
    .run()
  return results as AvgStatRow[]
}

export async function getAvgMonetary(db: D1Database): Promise<AvgStatRow[]> {
  const { results } = await db
    .prepare("SELECT Segment, ROUND(AVG(TotalSpending)) AS value FROM customers GROUP BY Segment")
    .run()
  return results as AvgStatRow[]
}

export async function getTransactionsForCustomer(db: D1Database, memberId: string, limit = 50): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare("SELECT * FROM transactions WHERE MemberID = ? ORDER BY Timestamp DESC LIMIT ?")
    .bind(memberId, limit)
    .run()
  return results
}

export async function getTransactionsSample(db: D1Database, limit = 1000): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare("SELECT * FROM transactions LIMIT ?")
    .bind(limit)
    .run()
  return results
}

export async function getRFMStats(db: D1Database) {
  const [segments, avgRecency, avgFrequency, avgMonetary] = await Promise.all([
    getSegmentDistribution(db),
    getAvgRecency(db),
    getAvgFrequency(db),
    getAvgMonetary(db),
  ])

  const total = segments.reduce((s, r) => s + r["Number of Customers"], 0)
  const { results } = await db.prepare("SELECT * FROM customers").all()

  return {
    segments,
    avgRecency,
    avgFrequency,
    avgMonetary,
    totalCustomers: total,
    results: results.results as CustomerRow[],
  }
}
