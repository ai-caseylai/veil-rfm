import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

interface CLVReport {
  params: { pnbd: number[]; ggg: number[] }
  customers: Array<{
    customerID: string
    pAlive: number
    expectedTransactions: number
    expectedSpendPerTxn: number
    lifetimeValue: number
  }>
  summary: {
    totalCLV: number
    avgCLV: number
    totalPAlive: number
    activeCustomerCount: number
  }
}

export default function LTVOverview({ data }: Props) {
  const { t, lang } = useT()
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [clvReport, setClvReport] = useState<CLVReport | null>(null)
  const [loading, setLoading] = useState(!rfmResult)

  useEffect(() => {
    async function load() {
      try {
        const [rfm, clv] = await Promise.all([
          rfmResult ? Promise.resolve(rfmResult) : computeRFM({ transactions: data.transactions }),
          fetch(`${API_BASE}/api/rfm/clv`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: data.transactions }),
          }).then((r) => r.json()),
        ])
        setRfmResult(rfm)
        if (!clv.error) setClvReport(clv)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [data.transactions])

  if (loading) return <div className="card"><div className="card-header"><div className="skeleton h-5 w-64" /></div><div className="card-body space-y-4"><div className="skeleton h-5 w-full" /><div className="skeleton h-96 w-full" /></div></div>
  if (!rfmResult) return <p className="text-red-500">{t.errorLoading}</p>

  const results = rfmResult.results as { Segment: string; TotalSpending: number; CustomerID: string }[]
  const segSpending = new Map<string, number[]>()
  for (const r of results) { const arr = segSpending.get(r.Segment) ?? []; arr.push(r.TotalSpending); segSpending.set(r.Segment, arr) }
  const ltvData = RFM_SEGMENT.map((seg) => {
    const vals = segSpending.get(seg) ?? []
    return { Segment: segLabel(seg, lang), "Avg LTV ($)": vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 }
  }).filter((d) => d["Avg LTV ($)"] > 0)

  const overallAvg = results.length > 0 ? results.reduce((s, r) => s + r.TotalSpending, 0) / results.length : 0

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">{t.avgLTVPerSegment}</div>
        <div className="card-body">
          <p className="text-sm text-gray-500 mb-4">
            {t.simpleEstimate} {t.overallAvg}: <strong>${overallAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={ltvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="Segment" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Avg LTV ($)" fill="#6b46c1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BTYD CLV Table */}
      {clvReport && (
        <div className="card">
          <div className="card-header">
            {loading ? "..." : lang === "zh-TW" ? "BTYD 客戶終身價值（Pareto/NBD + Gamma-Gamma）" : lang === "zh-CN" ? "BTYD 客户终身价值（Pareto/NBD + Gamma-Gamma）" : "BTYD Customer Lifetime Value (Pareto/NBD + Gamma-Gamma)"}
          </div>
          <div className="card-body">
            {/* Model params */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div className="bg-gray-50 rounded p-3">
                <div className="font-semibold text-gray-500 mb-1">{lang === "zh-TW" ? "Pareto/NBD 參數" : lang === "zh-CN" ? "Pareto/NBD 参数" : "Pareto/NBD Parameters"}</div>
                <div className="grid grid-cols-2 gap-1">
                  <span>r: {clvReport.params.pnbd[0]?.toFixed(3)}</span>
                  <span>α: {clvReport.params.pnbd[1]?.toFixed(3)}</span>
                  <span>s: {clvReport.params.pnbd[2]?.toFixed(3)}</span>
                  <span>β: {clvReport.params.pnbd[3]?.toFixed(3)}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="font-semibold text-gray-500 mb-1">{lang === "zh-TW" ? "Gamma-Gamma 參數" : lang === "zh-CN" ? "Gamma-Gamma 参数" : "Gamma-Gamma Parameters"}</div>
                <div className="grid grid-cols-3 gap-1">
                  <span>p: {clvReport.params.ggg[0]?.toFixed(3)}</span>
                  <span>q: {clvReport.params.ggg[1]?.toFixed(3)}</span>
                  <span>γ: {clvReport.params.ggg[2]?.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                [lang === "zh-TW" ? "總 CLV" : lang === "zh-CN" ? "总 CLV" : "Total CLV", `$${clvReport.summary.totalCLV.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                [lang === "zh-TW" ? "平均 CLV" : lang === "zh-CN" ? "平均 CLV" : "Avg CLV", `$${clvReport.summary.avgCLV.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                [lang === "zh-TW" ? "總存活率" : lang === "zh-CN" ? "总存活率" : "Total P(Alive)", clvReport.summary.totalPAlive.toFixed(1)],
                [lang === "zh-TW" ? "活躍 (>50%)" : lang === "zh-CN" ? "活跃 (>50%)" : "Active (>50%)", String(clvReport.summary.activeCustomerCount)],
              ].map(([label, value]) => (
                <div key={label} className="bg-white border rounded p-2 text-center">
                  <div className="text-[10px] text-gray-400">{label}</div>
                  <div className="font-bold text-[var(--primary)]">{value}</div>
                </div>
              ))}
            </div>

            {/* Per-customer table */}
            <div className="overflow-auto max-h-80">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === "zh-TW" ? "客戶" : lang === "zh-CN" ? "客户" : "Customer"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "存活率" : lang === "zh-CN" ? "存活率" : "P(Alive)"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "預期交易 (52週)" : lang === "zh-CN" ? "预期交易 (52周)" : "Expected Txns (52w)"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "平均消費/單" : lang === "zh-CN" ? "平均消费/单" : "Avg Spend/Txn"}</th>
                    <th className="text-right">{lang === "zh-TW" ? "終身價值" : lang === "zh-CN" ? "终身价值" : "Lifetime Value"}</th>
                  </tr>
                </thead>
                <tbody>
                  {clvReport.customers.map((c) => (
                    <tr key={c.customerID}>
                      <td className="mono">{c.customerID}</td>
                      <td className="text-right">{(c.pAlive * 100).toFixed(1)}%</td>
                      <td className="text-right">{c.expectedTransactions.toFixed(1)}</td>
                      <td className="text-right">${c.expectedSpendPerTxn.toFixed(0)}</td>
                      <td className="text-right font-bold">${c.lifetimeValue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
