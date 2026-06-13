import { useEffect, useState } from "react"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }
interface CustomerOption { id: string; segment: string; recency: number; frequency: number; monetary: number; totalSpending: number }
interface WhatIfResult {
  CustomerID: string
  original: { DaySinceLastTxn: number; NoOfTxn: number; MeanMoneyValue: number; TotalSpending: number; Segment: string; RecencyScore: number; FrequencyScore: number; MonetaryScore: number }
  modified: { DaySinceLastTxn: number; NoOfTxn: number; MeanMoneyValue: number; TotalSpending: number; Segment: string; RecencyScore: number; FrequencyScore: number; MonetaryScore: number }
  changes: { recencyDelta: number; frequencyDelta: number; monetaryDelta: number }
}

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

function Skeleton() {
  return <div className="card"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body space-y-4"><div className="skeleton h-10 w-full" /><div className="skeleton h-20 w-full" /><div className="skeleton h-40 w-full" /><div className="skeleton h-40 w-full" /></div></div>
}

export default function WhatIf({ data }: Props) {
  const { t, lang } = useT()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [selectedID, setSelectedID] = useState("")
  const [recency, setRecency] = useState(0)
  const [frequency, setFrequency] = useState(0)
  const [monetary, setMonetary] = useState(0)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    computeRFM({ transactions: data.transactions }).then((res) => {
      const results = res.results as { CustomerID: string; Segment: string; DaySinceLastTxn: number; NoOfTxn: number; MeanMoneyValue: number; TotalSpending: number }[]
      const rfmData = res.rfmData as { CustomerID: string; DaySinceLastTxn: number; NoOfTxn: number; MeanMoneyValue: number; TotalSpending: number }[]
      const opts: CustomerOption[] = rfmData.map((d) => {
        const r = results.find((x) => x.CustomerID === d.CustomerID)
        return { id: d.CustomerID, segment: r?.Segment ?? "Unknown", recency: d.DaySinceLastTxn, frequency: d.NoOfTxn, monetary: Math.round(d.MeanMoneyValue), totalSpending: Math.round(d.TotalSpending) }
      })
      setCustomers(opts)
      if (opts.length > 0) { setSelectedID(opts[0].id); setRecency(opts[0].recency); setFrequency(opts[0].frequency); setMonetary(opts[0].monetary) }
    }).catch(console.error).finally(() => setLoading(false))
  }, [data.transactions])

  const selected = customers.find((c) => c.id === selectedID)

  async function analyze() {
    setSimulating(true)
    try {
      const res = await fetch(`${API_BASE}/api/rfm/whatif`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: data.transactions, customerID: selectedID, scenario: { recency, frequency, monetary } }),
      })
      const json = await res.json()
      setResult(json.error ? null : json)
    } catch (e) { console.error(e) }
    finally { setSimulating(false) }
  }

  async function suggestTarget(target: string) {
    setSimulating(true)
    try {
      const res = await fetch(`${API_BASE}/api/rfm/whatif`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: data.transactions, customerID: selectedID, targetSegment: target }),
      })
      const json = await res.json()
      if (!json.error) { setRecency(json.modified.DaySinceLastTxn); setFrequency(json.modified.NoOfTxn); setMonetary(Math.round(json.modified.MeanMoneyValue)); setResult(json) }
    } catch (e) { console.error(e) }
    finally { setSimulating(false) }
  }

  if (loading) return <Skeleton />

  const segmentChanged = result && segLabel(result.original.Segment, lang) !== segLabel(result.modified.Segment, lang)

  return (
    <div>
      <div className="card">
        <div className="card-header">{t.whatIfAnalysis}</div>
        <div className="card-body">
          <label className="block text-sm font-medium mb-2">{t.selectCustomer}</label>
          <select value={selectedID} onChange={(e) => { setSelectedID(e.target.value); const c = customers.find((x) => x.id === e.target.value); if (c) { setRecency(c.recency); setFrequency(c.frequency); setMonetary(c.monetary); setResult(null) } }} className="w-full border rounded p-2 mb-4 text-sm">
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.id} — {c.segment} ({t.recencyDays}: {c.recency}d | {t.orders}: {c.frequency} | {t.avgSpendLabel}: ${c.monetary})</option>
            ))}
          </select>

          {selected && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-4 gap-3 text-center">
              <div><div className="text-xs text-gray-500">{t.recencyDays}</div><div className="font-bold">{selected.recency}d</div></div>
              <div><div className="text-xs text-gray-500">{t.orders}</div><div className="font-bold">{selected.frequency}</div></div>
              <div><div className="text-xs text-gray-500">{t.avgSpendLabel}</div><div className="font-bold">${selected.monetary}</div></div>
              <div><div className="text-xs text-gray-500">{t.segment}</div><div className="font-bold text-blue-600">{selected.segment}</div></div>
            </div>
          )}

          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1">{t.recencySlider}: <strong>{recency}</strong></label>
              <input type="range" min={0} max={Math.max(365, ...customers.map((c) => c.recency))} value={recency} onChange={(e) => setRecency(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t.frequencySlider}: <strong>{frequency}</strong></label>
              <input type="range" min={1} max={Math.max(30, ...customers.map((c) => c.frequency)) + 10} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t.monetarySlider}: <strong>${monetary}</strong></label>
              <input type="range" min={10} max={Math.max(1000, ...customers.map((c) => c.monetary)) * 2} step={10} value={monetary} onChange={(e) => setMonetary(Number(e.target.value))} className="w-full" />
            </div>
          </div>

          <button onClick={analyze} disabled={simulating} className="btn btn-primary">
            {simulating ? t.simulating : t.simulate}
          </button>
        </div>
      </div>

      {result && (
        <div className={`card ${segmentChanged ? "border-yellow-400 border-2" : ""}`}>
          <div className="card-header">
            {segmentChanged
              ? <span className="text-yellow-700">{t.segmentChanged} {segLabel(result.original.Segment, lang)} → {segLabel(result.modified.Segment, lang)}</span>
              : <span>{t.segmentUnchanged}: {segLabel(result.modified.Segment, lang)}</span>}
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-6">
              <div className="border-r pr-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">{t.original}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="py-1 text-gray-500">{t.segment}</td><td className="font-bold">{segLabel(result.original.Segment, lang)}</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.rfmScoreLabel}</td><td className="mono">{result.original.RecencyScore}{result.original.FrequencyScore}{result.original.MonetaryScore}</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.recencyDays}</td><td>{result.original.DaySinceLastTxn}d</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.orders}</td><td>{result.original.NoOfTxn}</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.avgSpendLabel}</td><td>${result.original.MeanMoneyValue.toFixed(0)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-blue-400 uppercase mb-2">{t.modified}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="py-1 text-gray-500">{t.segment}</td><td className="font-bold text-blue-600">{segLabel(result.modified.Segment, lang)}</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.rfmScoreLabel}</td><td className="mono">{result.modified.RecencyScore}{result.modified.FrequencyScore}{result.modified.MonetaryScore}</td></tr>
                    <tr><td className="py-1 text-gray-500">{t.recencyDays}</td><td>{result.modified.DaySinceLastTxn}d <span className={`text-xs ml-1 ${result.changes.recencyDelta <= 0 ? "text-green-600" : "text-red-600"}`}>({result.changes.recencyDelta >= 0 ? "+" : ""}{result.changes.recencyDelta})</span></td></tr>
                    <tr><td className="py-1 text-gray-500">{t.orders}</td><td>{result.modified.NoOfTxn} <span className={`text-xs ml-1 ${result.changes.frequencyDelta >= 0 ? "text-green-600" : "text-red-600"}`}>({result.changes.frequencyDelta >= 0 ? "+" : ""}{result.changes.frequencyDelta})</span></td></tr>
                    <tr><td className="py-1 text-gray-500">{t.avgSpendLabel}</td><td>${result.modified.MeanMoneyValue.toFixed(0)} <span className={`text-xs ml-1 ${result.changes.monetaryDelta >= 0 ? "text-green-600" : "text-red-600"}`}>({result.changes.monetaryDelta >= 0 ? "+" : ""}{result.changes.monetaryDelta})</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="card-header">{t.quickSuggest}</div>
          <div className="card-body">
            <div className="flex flex-wrap gap-2">
              {RFM_SEGMENT.filter((seg) => seg !== selected.segment).map((seg) => (
                <button key={seg} onClick={() => suggestTarget(seg)} disabled={simulating} className="btn btn-secondary text-xs">{seg}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
