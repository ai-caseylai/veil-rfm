import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from "recharts"
import type { AppData } from "../App"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"
const CLV_COLORS = ["#6b46c1","#805ad5","#9f7aea","#b794f4","#d6bcfa","#3182ce","#2b6cb0","#2c5282","#38a169","#d69e2e","#e53e3e"]

interface CLVReport {
  params: { pnbd: number[]; ggg: number[] }
  customers: Array<{
    customerID: string; pAlive: number; expectedTransactions: number
    expectedSpendPerTxn: number; lifetimeValue: number
  }>
  summary: { totalCLV: number; avgCLV: number; totalPAlive: number; activeCustomerCount: number }
}

export default function LTVOverview({ data }: Props) {
  const { t, lang } = useT()
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [clvReport, setClvReport] = useState<CLVReport | null>(null)
  const [loading, setLoading] = useState(!data.rfmData)

  useEffect(() => { if (data.rfmData) { setRfmResult(data.rfmData as Record<string, unknown>); setLoading(false) } }, [data.rfmData])

  useEffect(() => {
    async function load() {
      try {
        const [rfm, clv] = await Promise.all([
          rfmResult ? Promise.resolve(rfmResult) : Promise.resolve(null),
          fetch(`${API_BASE}/api/rfm/clv`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: [], seed: 20260603 }),
          }).then((r) => r.json()),
        ])
        if (rfm) setRfmResult(rfm)
        if (!clv.error) setClvReport(clv)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-64" />
      <div className="skeleton h-96 w-full" />
    </div>
  )
  if (!rfmResult && !clvReport) return <p className="text-red-500">{t.errorLoading}</p>

  // ── Simple LTV from spending ──
  const results = (rfmResult?.results ?? []) as { Segment: string; TotalSpending: number; CustomerID: string; DaySinceLastTxn: number; NoOfTxn: number }[]
  const segSpending = new Map<string, number[]>()
  for (const r of results) { const arr = segSpending.get(r.Segment) ?? []; arr.push(r.TotalSpending); segSpending.set(r.Segment, arr) }
  const ltvBySeg = RFM_SEGMENT.map((seg) => {
    const vals = segSpending.get(seg) ?? []
    return { Segment: segLabel(seg, lang), "Avg CLV ($)": vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0, Customers: vals.length }
  }).filter((d) => d.Customers > 0)
  const overallAvg = results.length > 0 ? results.reduce((s, r) => s + r.TotalSpending, 0) / results.length : 0

  // ── BTYD CLV data ──
  const clvCustomers = clvReport?.customers ?? []
  
  // CLV Distribution histogram
  const clvBuckets = [0, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, Infinity]
  const clvDist = clvBuckets.slice(0, -1).map((lo, i) => {
    const hi = clvBuckets[i + 1]
    const count = clvCustomers.filter((c) => c.lifetimeValue >= lo && c.lifetimeValue < hi).length
    return { range: hi === Infinity ? `$${lo.toLocaleString()}+` : `$${lo.toLocaleString()}-${(hi).toLocaleString()}`, count, lo }
  })

  // CLV by segment (join BTYD CLV with RFM segments)
  const segMap = new Map<string, string>()
  for (const r of results) segMap.set(r.CustomerID, r.Segment)
  const clvBySegmentRaw = new Map<string, number[]>()
  for (const c of clvCustomers) {
    const seg = segMap.get(c.customerID) ?? "Unknown"
    if (!clvBySegmentRaw.has(seg)) clvBySegmentRaw.set(seg, [])
    clvBySegmentRaw.get(seg)!.push(c.lifetimeValue)
  }
  const clvBySegment = RFM_SEGMENT
    .filter((seg) => clvBySegmentRaw.has(seg))
    .map((seg) => {
      const vals = clvBySegmentRaw.get(seg)!
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)]
      return { Segment: segLabel(seg, lang), avgCLV: Math.round(avg), medianCLV: Math.round(median), customers: vals.length, totalCLV: Math.round(vals.reduce((s, v) => s + v, 0)) }
    })

  // Top 10 / Bottom 10
  const sortedCLV = [...clvCustomers].sort((a, b) => b.lifetimeValue - a.lifetimeValue)
  const top10 = sortedCLV.slice(0, 10)
  const bottom10 = sortedCLV.slice(-10).reverse()

  // P(Alive) distribution
  const aliveBuckets = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99, 1.01]
  const aliveDist = aliveBuckets.slice(0, -1).map((lo, i) => {
    const hi = aliveBuckets[i + 1]
    const count = clvCustomers.filter((c) => c.pAlive >= lo && c.pAlive < hi).length
    return { range: hi >= 1 ? "99-100%" : `${(lo*100).toFixed(0)}-${((hi-0.01)*100).toFixed(0)}%`, count }
  })

  // Scatter: Recency vs CLV
  const scatterData = clvCustomers.slice(0, 500).map((c) => {
    const rfmRecency = results.find((r) => r.CustomerID === c.customerID)?.DaySinceLastTxn ?? 0
    return { recency: rfmRecency, clv: Math.round(c.lifetimeValue), customer: c.customerID, pAlive: c.pAlive }
  })

  const title1 = lang === "zh-TW" ? "客戶終身價值分析" : lang === "zh-CN" ? "客户终身价值分析" : "Customer Lifetime Value Analysis"
  const title2 = lang === "zh-TW" ? "BTYD 模型（Pareto/NBD + Gamma-Gamma）" : lang === "zh-CN" ? "BTYD 模型（Pareto/NBD + Gamma-Gamma）" : "BTYD Model (Pareto/NBD + Gamma-Gamma)"
  const clvDistTitle = lang === "zh-TW" ? "CLV 分佈" : lang === "zh-CN" ? "CLV 分布" : "CLV Distribution"
  const clvBySegTitle = lang === "zh-TW" ? "各分群 CLV" : lang === "zh-CN" ? "各分群 CLV" : "CLV by Segment"
  const aliveTitle = lang === "zh-TW" ? "客戶存活率分佈" : lang === "zh-CN" ? "客户存活率分布" : "P(Alive) Distribution"
  const scatterTitle = lang === "zh-TW" ? "最近購買天數 vs CLV" : lang === "zh-CN" ? "最近购买天数 vs CLV" : "Recency vs CLV"
  const topTitle = lang === "zh-TW" ? "CLV Top 10" : lang === "zh-CN" ? "CLV Top 10" : "Top 10 CLV"
  const bottomTitle = lang === "zh-TW" ? "CLV Bottom 10" : lang === "zh-CN" ? "CLV Bottom 10" : "Bottom 10 CLV"
  const totalCLVLabel = lang === "zh-TW" ? "總 CLV" : lang === "zh-CN" ? "总 CLV" : "Total CLV"
  const avgCLVLabel = lang === "zh-TW" ? "平均 CLV" : lang === "zh-CN" ? "平均 CLV" : "Avg CLV"
  const medianCLVLabel = lang === "zh-TW" ? "中位數 CLV" : lang === "zh-CN" ? "中位数 CLV" : "Median CLV"
  const aliveLabel = lang === "zh-TW" ? "存活率" : lang === "zh-CN" ? "存活率" : "P(Alive)"
  const activeLabel = lang === "zh-TW" ? "活躍 (>50%)" : lang === "zh-CN" ? "活跃 (>50%)" : "Active (>50%)"

  return (
    <div className="max-w-6xl space-y-4">
      <h2 className="text-xl font-semibold text-[var(--primary)]">{title1}</h2>

      {/* ── SECTION 1: Simple LTV Overview ── */}
      <div className="card">
        <div className="card-header">{t.avgLTVPerSegment}</div>
        <div className="card-body">
          <p className="text-sm text-gray-500 mb-4">
            {t.simpleEstimate} {t.overallAvg}: <strong>${overallAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={ltvBySeg}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="Segment" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Bar dataKey="Avg CLV ($)" fill="#6b46c1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 2: BTYD CLV ── */}
      {clvReport && (
        <>
          <h3 className="text-lg font-semibold text-[var(--primary)]">{title2}</h3>

          {/* Model Parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card">
              <div className="card-header text-sm">{lang === "zh-TW" ? "Pareto/NBD 參數" : lang === "zh-CN" ? "Pareto/NBD 参数" : "Pareto/NBD Parameters"}</div>
              <div className="card-body">
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {[
                    ["r (交易頻率)", clvReport.params.pnbd[0]],
                    ["α (交易衰減)", clvReport.params.pnbd[1]],
                    ["s (流失傾向)", clvReport.params.pnbd[2]],
                    ["β (流失衰減)", clvReport.params.pnbd[3]],
                  ].map(([label, val]) => (
                    <div key={label}><div className="text-gray-400 text-xs">{label}</div><div className="font-mono font-bold">{Number(val).toFixed(3)}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header text-sm">{lang === "zh-TW" ? "Gamma-Gamma 參數" : lang === "zh-CN" ? "Gamma-Gamma 参数" : "Gamma-Gamma Parameters"}</div>
              <div className="card-body">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {[
                    ["p (消費形狀)", clvReport.params.ggg[0]],
                    ["q (消費尺度)", clvReport.params.ggg[1]],
                    ["γ (消費衰減)", clvReport.params.ggg[2]],
                  ].map(([label, val]) => (
                    <div key={label}><div className="text-gray-400 text-xs">{label}</div><div className="font-mono font-bold text-xs">{typeof val === 'number' ? (val < 0.001 ? val.toExponential(1) : val.toFixed(3)) : '?'}</div></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              [totalCLVLabel, `$${clvReport.summary.totalCLV.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "#6b46c1"],
              [avgCLVLabel, `$${clvReport.summary.avgCLV.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "#3182ce"],
              [medianCLVLabel, `$${(sortedCLV[Math.floor(sortedCLV.length/2)]?.lifetimeValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "?"}`, "#38a169"],
              [aliveLabel, clvReport.summary.totalPAlive.toFixed(1), "#d69e2e"],
              [activeLabel, String(clvReport.summary.activeCustomerCount), "#e53e3e"],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-white rounded-lg p-3 border shadow-sm text-center">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-lg font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* CLV Distribution + P(Alive) Distribution side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">{clvDistTitle}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clvDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="count" fill="#6b46c1" radius={[4, 4, 0, 0]} name={t.totalCustomers} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-xs text-gray-400 text-center mt-2">
                  {lang === "zh-TW" ? `${clvDist.filter(d=>d.count>0).length} 個區間有客戶` : lang === "zh-CN" ? `${clvDist.filter(d=>d.count>0).length} 个区间有客户` : `${clvDist.filter(d=>d.count>0).length} brackets with customers`}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">{aliveTitle}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aliveDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="count" fill="#38a169" radius={[4, 4, 0, 0]} name={t.totalCustomers} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* CLV by Segment + Scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">{clvBySegTitle}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={clvBySegment} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="Segment" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="avgCLV" fill="#805ad5" radius={[0, 4, 4, 0]} name="Avg CLV">
                      {clvBySegment.map((_, i) => <Cell key={i} fill={CLV_COLORS[i % CLV_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">{scatterTitle}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="recency" name={lang === "zh-TW" ? "最近購買天數" : "Recency (days)"} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="clv" name="CLV ($)" tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
                    <ZAxis range={[20, 20]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => [name === 'clv' ? `$${value.toLocaleString()}` : `${value}d`, name === 'clv' ? 'CLV' : 'Recency']} />
                    <Scatter data={scatterData} fill="#6b46c1" opacity={0.4} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top 10 + Bottom 10 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">{topTitle}</div>
              <div className="card-body overflow-auto">
                <table className="data-table text-sm w-full">
                  <thead><tr><th>#</th><th>{t.customerID}</th><th className="text-right">{aliveLabel}</th><th className="text-right">{lang === "zh-TW" ? "預期交易" : "Exp. Txns"}</th><th className="text-right">CLV</th></tr></thead>
                  <tbody>
                    {top10.map((c, i) => (
                      <tr key={c.customerID}>
                        <td className="text-gray-400">{i + 1}</td>
                        <td className="mono text-xs">{c.customerID}</td>
                        <td className="text-right">{(c.pAlive * 100).toFixed(0)}%</td>
                        <td className="text-right">{c.expectedTransactions.toFixed(0)}</td>
                        <td className="text-right font-bold text-[#6b46c1]">${c.lifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">{bottomTitle}</div>
              <div className="card-body overflow-auto">
                <table className="data-table text-sm w-full">
                  <thead><tr><th>#</th><th>{t.customerID}</th><th className="text-right">{aliveLabel}</th><th className="text-right">{lang === "zh-TW" ? "預期交易" : "Exp. Txns"}</th><th className="text-right">CLV</th></tr></thead>
                  <tbody>
                    {bottom10.map((c, i) => (
                      <tr key={c.customerID}>
                        <td className="text-gray-400">{i + 1}</td>
                        <td className="mono text-xs">{c.customerID}</td>
                        <td className="text-right">{(c.pAlive * 100).toFixed(0)}%</td>
                        <td className="text-right">{c.expectedTransactions.toFixed(0)}</td>
                        <td className="text-right font-bold text-[#e53e3e]">${c.lifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Full customer table */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span>{lang === "zh-TW" ? "全部客戶 CLV" : lang === "zh-CN" ? "全部客户 CLV" : "All Customers CLV"}</span>
              <span className="text-xs text-gray-400">{clvCustomers.length.toLocaleString()} {lang === "zh-TW" ? "位客戶" : lang === "zh-CN" ? "位客户" : "customers"}</span>
            </div>
            <div className="card-body overflow-auto max-h-96">
              <table className="data-table text-sm w-full">
                <thead>
                  <tr>
                    <th>{lang === "zh-TW" ? "客戶" : "Customer"}</th>
                    <th className="text-right">{aliveLabel}</th>
                    <th className="text-right">{lang === "zh-TW" ? "預期交易 (52週)" : "Exp. Txns (52w)"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "平均消費/單" : "Avg/Txn"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "終身價值" : "Lifetime Value"}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCLV.slice(0, 100).map((c) => (
                    <tr key={c.customerID}>
                      <td className="mono text-xs">{c.customerID}</td>
                      <td className="text-right">{(c.pAlive * 100).toFixed(1)}%</td>
                      <td className="text-right">{c.expectedTransactions.toFixed(1)}</td>
                      <td className="text-right">${c.expectedSpendPerTxn.toFixed(0)}</td>
                      <td className="text-right font-bold">${c.lifetimeValue.toFixed(0)}</td>
                    </tr>
                  ))}
                  {sortedCLV.length > 100 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 text-xs py-2">
                      {lang === "zh-TW" ? `... 還有 ${sortedCLV.length - 100} 位客戶` : lang === "zh-CN" ? `... 还有 ${sortedCLV.length - 100} 位客户` : `... ${sortedCLV.length - 100} more customers`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
