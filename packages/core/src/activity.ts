import type { Transaction } from "./types"

export interface DailyActivity {
  date: string       // YYYY-MM-DD
  transactions: number
  revenue: number
  customers: number
}

export interface MonthlyActivity {
  month: string      // YYYY-MM
  transactions: number
  revenue: number
  customers: number
}

export interface WeeklyActivity {
  week: string       // YYYY-Www
  transactions: number
  revenue: number
  customers: number
}

export interface ActivityResult {
  daily: DailyActivity[]
  weekly: WeeklyActivity[]
  monthly: MonthlyActivity[]
  summary: {
    totalTransactions: number
    totalRevenue: number
    totalCustomers: number
    avgDailyTransactions: number
    avgWeeklyTransactions: number
    avgMonthlyTransactions: number
    busiestDay: { date: string; transactions: number }
    busiestMonth: { month: string; transactions: number }
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWeek(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  const week = Math.ceil((days + start.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`
}

function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function computeActivity(transactions: Transaction[]): ActivityResult {
  const daily = new Map<string, { txn: Set<string>; rev: number; cust: Set<string> }>()
  const weekly = new Map<string, { txn: Set<string>; rev: number; cust: Set<string> }>()
  const monthly = new Map<string, { txn: Set<string>; rev: number; cust: Set<string> }>()

  for (const t of transactions) {
    if (!t.Timestamp) continue
    const d = new Date(t.Timestamp)
    if (isNaN(d.getTime())) continue

    const price = t.NetPrice ?? t.TotalPrice ?? 0
    const day = toDateStr(d)
    const week = getWeek(d)
    const month = toMonthStr(d)

    for (const [map, key] of [[daily, day], [weekly, week], [monthly, month]] as const) {
      const entry = map.get(key) ?? { txn: new Set(), rev: 0, cust: new Set() }
      entry.txn.add(t.OrderID)
      entry.rev += price
      entry.cust.add(t.MemberID)
      map.set(key, entry)
    }
  }

  const toSorted = <T extends { date?: string; week?: string; month?: string }>(
    map: Map<string, { txn: Set<string>; rev: number; cust: Set<string> }>,
    keyField: string,
  ): T[] => {
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ [keyField]: key, transactions: v.txn.size, revenue: Math.round(v.rev * 100) / 100, customers: v.cust.size } as unknown as T))
  }

  const dailyArr = toSorted<DailyActivity>(daily, "date")
  const weeklyArr = toSorted<WeeklyActivity>(weekly, "week")
  const monthlyArr = toSorted<MonthlyActivity>(monthly, "month")

  const totalTxn = dailyArr.reduce((s, d) => s + d.transactions, 0)
  const totalRev = dailyArr.reduce((s, d) => s + d.revenue, 0)
  const totalCust = new Set(transactions.map((t) => t.MemberID)).size

  const busiestDay = dailyArr.reduce((max, d) => d.transactions > max.transactions ? d : max, dailyArr[0] ?? { date: "-", transactions: 0 })
  const busiestMonth = monthlyArr.reduce((max, m) => m.transactions > max.transactions ? m : max, monthlyArr[0] ?? { month: "-", transactions: 0 })

  return {
    daily: dailyArr,
    weekly: weeklyArr,
    monthly: monthlyArr,
    summary: {
      totalTransactions: totalTxn,
      totalRevenue: totalRev,
      totalCustomers: totalCust,
      avgDailyTransactions: dailyArr.length > 0 ? Math.round(totalTxn / dailyArr.length) : 0,
      avgWeeklyTransactions: weeklyArr.length > 0 ? Math.round(totalTxn / weeklyArr.length) : 0,
      avgMonthlyTransactions: monthlyArr.length > 0 ? Math.round(totalTxn / monthlyArr.length) : 0,
      busiestDay: { date: busiestDay.date, transactions: busiestDay.transactions },
      busiestMonth: { month: busiestMonth.month, transactions: busiestMonth.transactions },
    },
  }
}
