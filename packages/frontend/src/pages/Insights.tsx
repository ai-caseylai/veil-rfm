import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"
import { RFM_SEGMENT } from "@veil-rfm/core"

interface Props { data: AppData }
const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"
const COLORS = ["#3182ce","#2b6cb0","#2c5282","#38a169","#2f855a","#d69e2e","#b7791f","#e53e3e","#c53030","#718096","#4a5568"]

type Tab = "trends" | "cohort" | "products"

export default function Insights({ data }: Props) {
  const { t, lang } = useT()
  const [tab, setTab] = useState<Tab>("trends")
  const [cohortData, setCohortData] = useState<Record<string, unknown>[]>([])
  const [categoryData, setCategoryData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const tabs: [Tab, string][] = [
    ["trends", lang === "zh-TW" ? "分群趨勢" : lang === "zh-CN" ? "分群趋势" : "Segment Trends"],
    ["cohort", lang === "zh-TW" ? "同期群" : lang === "zh-CN" ? "同期群" : "Cohort"],
    ["products", lang === "zh-TW" ? "產品類別" : lang === "zh-CN" ? "产品类别" : "Categories"],
  ]

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [cohortRes, catRes] = await Promise.all([
          fetch(`${API_BASE}/api/rfm/cohort`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: [], seed: 20260603 }) }).then(r => r.json()),
          fetch(`${API_BASE}/api/rfm/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: [], seed: 20260603 }) }).then(r => r.json()),
        ])
        if (!cohortRes.error) setCohortData(cohortRes)
        if (!catRes.error) setCategoryData(catRes)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // ── Segment Trends (from transition predicted data) ──
  const predicted = (data.transition?.predicted as Array<{ Time: number; Segment: string; Predicted: number }> ?? [])
  const trendMap = new Map<number, Record<string, number>>()
  for (const p of predicted) {
    const row = trendMap.get(p.Time) ?? {}
    row[segLabel(p.Segment, lang)] = p.Predicted
    trendMap.set(p.Time, row)
  }
  const trendChart = [...trendMap.entries()].sort(([a], [b]) => a - b).map(([t, segs]) => ({ period: `T${t}`, ...segs }))
  const trendSegs = RFM_SEGMENT.map((s) => segLabel(s, lang))

  if (!data.rfmData) return <div className="flex items-center justify-center h-64"><div className="skeleton h-8 w-64" /></div>

  return (
    <div className="max-w-6xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="skeleton h-64 w-full" />}

      {/* ── Tab 1: Segment Trends ── */}
      {tab === "trends" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">{lang === "zh-TW" ? "分群預測趨勢" : lang === "zh-CN" ? "分群预测趋势" : "Segment Forecast Trends"}</div>
            <div className="card-body">
              <p className="text-xs text-gray-500 mb-3">
                {lang === "zh-TW" ? "Markov Chain 預測未來 6 期各分群客戶數變化。線條向上 = 分群成長，向下 = 萎縮。" : lang === "zh-CN" ? "Markov Chain 预测未来 6 期各分群客户数变化。线条向上 = 分群成长，向下 = 萎缩。" : "Markov Chain forecast of segment populations over 6 periods. Up = growing, Down = shrinking."}
              </p>
              <ResponsiveContainer width="100%" height={420}>
                <AreaChart data={trendChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {trendSegs.map((seg, i) => (
                    <Area key={seg} type="monotone" dataKey={seg} stackId="0" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Segment health summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RFM_SEGMENT.map((seg, i) => {
              const lastT = trendChart[trendChart.length - 1]
              const firstT = trendChart[0]
              const segLabel2 = segLabel(seg, lang)
              const lastVal: number = (lastT as unknown as Record<string, number>)?.[segLabel2] ?? 0
              const firstVal: number = (firstT as unknown as Record<string, number>)?.[segLabel2] ?? 0
              const delta = lastVal - firstVal
              return (
                <div key={seg} className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="text-xs text-gray-400 truncate">{segLabel2}</div>
                  <div className="text-lg font-bold" style={{ color: COLORS[i % COLORS.length] }}>{Math.round(lastVal).toLocaleString()}</div>
                  <div className={`text-xs ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-400"}`}>
                    {delta > 0 ? "+" : ""}{Math.round(delta)} vs T0
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab 2: Cohort Analysis ── */}
      {tab === "cohort" && (
        <div className="card">
          <div className="card-header">{lang === "zh-TW" ? "同期群留存分析" : lang === "zh-CN" ? "同期群留存分析" : "Cohort Retention Analysis"}</div>
          <div className="card-body">
            <p className="text-xs text-gray-500 mb-3">
              {lang === "zh-TW" ? "按首次購買月份分組，追蹤各組客戶在後續月份的留存率。" : lang === "zh-CN" ? "按首次购买月份分组，追踪各组客户在后续月份的留存率。" : "Groups customers by first purchase month and tracks retention over subsequent months."}
            </p>
            {cohortData.length > 0 ? (
              <div className="overflow-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>{lang === "zh-TW" ? "首次購買" : lang === "zh-CN" ? "首次购买" : "First Purchase"}</th>
                      <th className="text-right">{lang === "zh-TW" ? "客戶數" : lang === "zh-CN" ? "客户数" : "Cohort Size"}</th>
                      {Array.from({ length: 6 }, (_, i) => (
                        <th key={i} className="text-right">{lang === "zh-TW" ? `M+${i+1}` : `M+${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.slice(0, 12).map((row: Record<string, unknown>, i: number) => (
                      <tr key={i}>
                        <td className="font-medium">{String(row.month ?? "")}</td>
                        <td className="text-right">{Number(row.size ?? 0)}</td>
                        {Array.from({ length: 6 }, (_, j) => (
                          <td key={j} className="text-right">
                            <span style={{ color: (Number(row[`m${j+1}`] ?? 0) > 0.5 ? "#38a169" : (Number(row[`m${j+1}`] ?? 0) > 0.3 ? "#d69e2e" : "#e53e3e")) }}>
                              {((Number(row[`m${j+1}`] ?? 0)) * 100).toFixed(0)}%
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                {lang === "zh-TW" ? "載入中或無法計算同期群資料" : lang === "zh-CN" ? "加载中或无法计算同期群数据" : "Loading or unable to compute cohort data"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Product Categories ── */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">{lang === "zh-TW" ? "各分群產品類別偏好" : lang === "zh-CN" ? "各分群产品类别偏好" : "Category Preferences by Segment"}</div>
            <div className="card-body">
              <p className="text-xs text-gray-500 mb-3">
                {lang === "zh-TW" ? "顯示每個分群在各產品類別的消費金額分佈。顏色越深 = 佔比越高。" : lang === "zh-CN" ? "显示每个分群在各产品类别的消费金额分布。颜色越深 = 占比越高。" : "Spending distribution across categories for each segment. Darker = higher share."}
              </p>
              {categoryData.length > 0 ? (
                <div className="overflow-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>{t.segment}</th>
                        {Array.from(new Set(categoryData.map((r: Record<string, unknown>) => String(r.Category ?? "")))).map((cat) => (
                          <th key={cat} className="text-right">{cat}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const segs = new Map<string, Record<string, number>>()
                        for (const r of categoryData as Array<Record<string, unknown>>) {
                          const s = segLabel(String(r.Segment ?? ""), lang)
                          if (!segs.has(s)) segs.set(s, {})
                          segs.get(s)![String(r.Category ?? "")] = Number(r.Spending ?? 0)
                        }
                        const allCats = Array.from(new Set((categoryData as Array<Record<string, unknown>>).map(r => String(r.Category ?? ""))))
                        return [...segs.entries()].map(([seg, cats]) => {
                          const total = Object.values(cats).reduce((s, v) => s + v, 0)
                          return (
                            <tr key={seg}>
                              <td className="font-medium">{seg}</td>
                              {allCats.map((cat) => {
                                const pct = cats[cat] ? cats[cat] / total : 0
                                return <td key={cat} className="text-right" style={{ backgroundColor: `rgba(49,130,206,${pct * 0.3})` }}>{pct > 0 ? `${(pct * 100).toFixed(0)}%` : "-"}</td>
                              })}
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  {lang === "zh-TW" ? "載入中..." : lang === "zh-CN" ? "加载中..." : "Loading..."}
                </p>
              )}
            </div>
          </div>

          {/* Category bar chart */}
          <div className="card">
            <div className="card-header">{lang === "zh-TW" ? "類別消費分佈" : lang === "zh-CN" ? "类别消费分布" : "Category Spending Distribution"}</div>
            <div className="card-body">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(() => {
                    const catTotal = new Map<string, number>()
                    for (const r of categoryData as Array<Record<string, unknown>>) {
                      catTotal.set(String(r.Category ?? ""), (catTotal.get(String(r.Category ?? "")) ?? 0) + Number(r.Spending ?? 0))
                    }
                    return [...catTotal.entries()].map(([cat, val]) => ({ Category: cat, Spending: Math.round(val) }))
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="Category" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Spending" fill="#3182ce" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="skeleton h-80 w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
