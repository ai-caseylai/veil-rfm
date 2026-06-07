import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"
import type { DailyActivity, MonthlyActivity, WeeklyActivity, ActivityResult } from "@veil-rfm/core"

interface Props { data: AppData }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

function Skeleton() {
  return (
    <div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-64" /></div><div className="card-body"><div className="skeleton h-80 w-full" /></div></div>
      <div className="card mt-4"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body"><div className="skeleton h-80 w-full" /></div></div>
    </div>
  )
}

export default function CustomerActivity({ data }: Props) {
  const { t, lang } = useT()
  const [activity, setActivity] = useState<ActivityResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/rfm/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: data.transactions }),
        })
        const json = await res.json()
        if (!json.error) setActivity(json)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [data.transactions])

  if (loading) return <Skeleton />
  if (!activity) return <p className="text-red-500">{t.errorLoading}</p>

  const title = lang === "zh-TW" ? "客戶活動分析" : lang === "zh-CN" ? "客户活动分析" : "Customer Activity"
  const totalTxnTitle = lang === "zh-TW" ? "總交易次數" : lang === "zh-CN" ? "总交易次数" : "Total Number of Transactions"
  const dailyTitle = lang === "zh-TW" ? "每日交易量" : lang === "zh-CN" ? "每日交易量" : "Daily Transactions"
  const monthlyTitle = lang === "zh-TW" ? "每月交易量" : lang === "zh-CN" ? "每月交易量" : "Monthly Transactions"
  const revenueTitle = lang === "zh-TW" ? "每日營收" : lang === "zh-CN" ? "每日营收" : "Daily Revenue"
  const customersTitle = lang === "zh-TW" ? "活躍客戶數" : lang === "zh-CN" ? "活跃客户数" : "Active Customers"
  const txnLabel = lang === "zh-TW" ? "交易" : lang === "zh-CN" ? "交易" : "Txn"
  const revLabel = lang === "zh-TW" ? "營收" : lang === "zh-CN" ? "营收" : "Revenue"
  const custLabel = lang === "zh-TW" ? "客戶" : lang === "zh-CN" ? "客户" : "Customers"
  const busiestDayLabel = lang === "zh-TW" ? "最繁忙日" : lang === "zh-CN" ? "最繁忙日" : "Busiest Day"
  const busiestMonthLabel = lang === "zh-TW" ? "最繁忙月" : lang === "zh-CN" ? "最繁忙月" : "Busiest Month"
  const avgDailyLabel = lang === "zh-TW" ? "日均交易" : lang === "zh-CN" ? "日均交易" : "Avg Daily"
  const avgMonthlyLabel = lang === "zh-TW" ? "月均交易" : lang === "zh-CN" ? "月均交易" : "Avg Monthly"

  // Format dates for display
  const dailyData = activity.daily.map((d: DailyActivity) => ({ ...d, label: d.date.slice(5) }))
  const monthlyData = activity.monthly.map((m: MonthlyActivity) => ({ ...m, label: m.month }))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          [totalTxnTitle, activity.summary.totalTransactions.toLocaleString()],
          [avgDailyLabel, activity.summary.avgDailyTransactions.toLocaleString()],
          [busiestDayLabel, `${activity.summary.busiestDay.date} (${activity.summary.busiestDay.transactions})`],
          [busiestMonthLabel, `${activity.summary.busiestMonth.month} (${activity.summary.busiestMonth.transactions})`],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
            <div className="text-lg font-bold text-[var(--primary)]">{value}</div>
          </div>
        ))}
      </div>

      {/* Daily Transaction Volume */}
      <div className="card mb-4">
        <div className="card-header">{dailyTitle}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(dailyData.length / 15))} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="transactions" fill="#3182ce" radius={[2, 2, 0, 0]} name={txnLabel} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Transaction Volume */}
      <div className="card mb-4">
        <div className="card-header">{monthlyTitle}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="transactions" fill="#38a169" radius={[4, 4, 0, 0]} name={txnLabel} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Revenue + Customers Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="card-header">{revenueTitle}</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(dailyData.length / 15))} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#6b46c1" fill="#6b46c1" fillOpacity={0.15} name={revLabel} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">{customersTitle}</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(dailyData.length / 15))} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="customers" stroke="#d69e2e" fill="#d69e2e" fillOpacity={0.15} name={custLabel} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
