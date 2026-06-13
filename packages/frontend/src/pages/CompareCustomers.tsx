import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

interface CustRow {
  CustomerID: string; Segment: string; RecencyScore: number; FrequencyScore: number; MonetaryScore: number
  DaySinceLastTxn: number; NoOfTxn: number; TotalSpending: number; AvgOrderValue: number
}

export default function CompareCustomers() {
  const { t, lang } = useT()
  const [ids, setIds] = useState("")
  const [customers, setCustomers] = useState<CustRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function compare() {
    const idList = ids.split(/[,;\s]+/).filter(Boolean).slice(0, 3)
    if (idList.length < 2) { setError(lang === "zh-TW" ? "請輸入至少 2 個客戶 ID" : lang === "zh-CN" ? "请输入至少 2 个客户 ID" : "Enter at least 2 customer IDs"); return }
    setLoading(true); setError("")
    try {
      const results = await Promise.all(
        idList.map((id) => fetch(`${API_BASE}/api/customers?search=${encodeURIComponent(id)}`).then((r) => r.json()))
      )
      const found = results.filter((r) => Array.isArray(r) && r.length > 0).map((r) => r[0] as CustRow)
      if (found.length < 2) { setError(lang === "zh-TW" ? "找不到足夠的客戶" : lang === "zh-CN" ? "找不到足够的客户" : "Not enough customers found"); setCustomers([]) }
      else setCustomers(found)
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }

  const chartData = customers.map((c) => ({
    name: c.CustomerID,
    [lang === "zh-TW" ? "消費金額" : lang === "zh-CN" ? "消费金额" : "Spending ($)"]: c.TotalSpending,
    [t.orders]: c.NoOfTxn,
    [lang === "zh-TW" ? "最近購買(天)" : lang === "zh-CN" ? "最近购买(天)" : "Recency (days)"]: c.DaySinceLastTxn,
  }))

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-bold text-[var(--primary)] mb-4">
        {lang === "zh-TW" ? "客戶比較" : lang === "zh-CN" ? "客户比较" : "Customer Comparison"}
      </h2>

      <div className="flex gap-2 mb-4">
        <input type="text" value={ids} onChange={(e) => setIds(e.target.value)}
          placeholder={lang === "zh-TW" ? "輸入 2-3 個客戶 ID（逗號分隔）" : lang === "zh-CN" ? "输入 2-3 个客户 ID（逗号分隔）" : "Enter 2-3 customer IDs (comma-separated)"}
          className="border border-[var(--border)] rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:border-[var(--accent)]" />
        <button onClick={compare} disabled={loading}
          className="btn btn-primary text-sm px-6">{loading ? t.loading : lang === "zh-TW" ? "比較" : lang === "zh-CN" ? "比较" : "Compare"}</button>
      </div>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {customers.length >= 2 && (
        <>
          {/* Side-by-side cards */}
          <div className={`grid grid-cols-1 ${customers.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-3 mb-4`}>
            {customers.map((c) => (
              <div key={c.CustomerID} className="card border-t-4 border-t-[var(--accent)]">
                <div className="card-body text-sm space-y-1">
                  <div className="font-bold text-[var(--primary)]">{c.CustomerID}</div>
                  <div className="text-xs text-gray-500">{segLabel(c.Segment, lang)} · RFM {c.RecencyScore}{c.FrequencyScore}{c.MonetaryScore}</div>
                  <hr className="my-1" />
                  <div className="flex justify-between text-xs"><span className="text-gray-400">{lang === "zh-TW" ? "總消費" : lang === "zh-CN" ? "总消费" : "Total"}</span><span className="font-medium">${c.TotalSpending.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">{t.orders}</span><span>{c.NoOfTxn}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">{lang === "zh-TW" ? "每單平均" : lang === "zh-CN" ? "每单平均" : "Avg/Order"}</span><span>${c.AvgOrderValue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400">{lang === "zh-TW" ? "最近購買" : lang === "zh-CN" ? "最近购买" : "Recency"}</span><span>{c.DaySinceLastTxn}{lang === "zh-TW" ? "天前" : lang === "zh-CN" ? "天前" : "d"}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison chart */}
          <div className="card">
            <div className="card-header">{lang === "zh-TW" ? "對比圖表" : lang === "zh-CN" ? "对比图表" : "Comparison Chart"}</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={lang === "zh-TW" ? "消費金額" : lang === "zh-CN" ? "消费金额" : "Spending ($)"} fill="#3182ce" radius={[4,4,0,0]} />
                  <Bar dataKey={t.orders} fill="#38a169" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
