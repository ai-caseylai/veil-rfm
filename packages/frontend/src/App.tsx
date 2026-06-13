import { useState, useEffect, useCallback } from "react"
import { Routes, Route, NavLink } from "react-router-dom"
import ChatBot from "./components/ChatBot"
import { SAMPLE_TRANSACTIONS } from "./lib/sampleData"
import { useT } from "./lib/i18n"
import type { Lang } from "./lib/i18n"
import { loadPrecomputedRFM } from "./lib/api"
import type { Transaction } from "@veil-rfm/core"
import Papa from "papaparse"

import RFMOverview from "./pages/RFMOverview"
import RFMCharacteristics from "./pages/RFMCharacteristics"
import RFMTransition from "./pages/RFMTransition"
import RFMCustomerSummary from "./pages/RFMCustomerSummary"
import LTVOverview from "./pages/LTVOverview"
import WhatIf from "./pages/WhatIf"
import CustomerActivity from "./pages/CustomerActivity"
import Recommend from "./pages/Recommend"
import QA500 from "./pages/QA500"

export interface AppData {
  transactions: Transaction[]
  rfmData: Record<string, unknown> | null
  transition: Record<string, unknown> | null
}

export default function App() {
  const { t, lang, setLang } = useT()
  const [loading, setLoading] = useState(true)
  const [prefillQuestion, setPrefillQuestion] = useState("")
  const [data, setData] = useState<AppData>({
    transactions: SAMPLE_TRANSACTIONS,
    rfmData: null,
    transition: null,
  })

  // Load 5,000-customer RFM data: split into 5 batches of 1,000 to stay under Worker CPU limit
  useEffect(() => {
    setLoading(true)
    const BATCH_SIZE = 1000
    const BATCHES = 5
    const seeds = [20260603, 20260701, 20260801, 20260901, 20261001]

    Promise.all(
      seeds.map((seed) => loadPrecomputedRFM({ n: BATCH_SIZE, seed }))
    )
      .then((results) => {
        // Merge RFM stats across batches
        const mergedSegments: Record<string, number> = {}
        const mergedAvgRecency: Record<string, { sum: number; count: number }> = {}
        const mergedAvgFrequency: Record<string, { sum: number; count: number }> = {}
        const mergedAvgMonetary: Record<string, { sum: number; count: number }> = {}
        let totalResults: Record<string, unknown>[] = []

        for (const r of results) {
          const segments = r.rfm.segments as Array<{ Segment: string; "Number of Customers": number; Percentage: number }>
          const avgR = r.rfm.avgRecency as Array<{ Segment: string; value: number }>
          const avgF = r.rfm.avgFrequency as Array<{ Segment: string; value: number }>
          const avgM = r.rfm.avgMonetary as Array<{ Segment: string; value: number }>
          const rr = r.rfm.results as Array<Record<string, unknown>>

          for (const s of segments) {
            mergedSegments[s.Segment] = (mergedSegments[s.Segment] ?? 0) + s["Number of Customers"]
          }
          for (const a of avgR) {
            const e = mergedAvgRecency[a.Segment] ?? { sum: 0, count: 0 }
            mergedAvgRecency[a.Segment] = { sum: e.sum + a.value * (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0), count: e.count + (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0) }
          }
          for (const a of avgF) {
            const e = mergedAvgFrequency[a.Segment] ?? { sum: 0, count: 0 }
            mergedAvgFrequency[a.Segment] = { sum: e.sum + a.value * (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0), count: e.count + (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0) }
          }
          for (const a of avgM) {
            const e = mergedAvgMonetary[a.Segment] ?? { sum: 0, count: 0 }
            mergedAvgMonetary[a.Segment] = { sum: e.sum + a.value * (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0), count: e.count + (segments.find((s) => s.Segment === a.Segment)?.["Number of Customers"] ?? 0) }
          }
          totalResults = totalResults.concat(rr)
        }

        const totalCustomers = Object.values(mergedSegments).reduce((s, v) => s + v, 0)
        const merged = {
          rfm: {
            ...results[0].rfm,
            results: totalResults,
            segments: Object.entries(mergedSegments).map(([Segment, count]) => ({
              Segment,
              "Number of Customers": count,
              Percentage: count / totalCustomers,
            })),
            avgRecency: Object.entries(mergedAvgRecency).map(([Segment, e]) => ({
              Segment,
              value: e.count > 0 ? Math.round(e.sum / e.count) : 0,
            })),
            avgFrequency: Object.entries(mergedAvgFrequency).map(([Segment, e]) => ({
              Segment,
              value: e.count > 0 ? Math.round(e.sum / e.count) : 0,
            })),
            avgMonetary: Object.entries(mergedAvgMonetary).map(([Segment, e]) => ({
              Segment,
              value: e.count > 0 ? Math.round(e.sum / e.count) : 0,
            })),
          },
          transition: results[0].transition,
        }
        setData((d) => ({ ...d, rfmData: merged.rfm, transition: merged.transition }))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadSynthetic5000 = async () => {
    setLoading(true)
    try {
      const resp = await fetch("/data/synthetic_5000_txn.csv")
      const text = await resp.text()
      const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
      const txns: Transaction[] = (parsed.data as Record<string, unknown>[]).map((row) => ({
        MemberID: row.MemberID as string,
        OrderID: row.OrderID as string,
        Timestamp: (row.Timestamp as string).replace(" ", "T").replace(":00", ":00Z"),
        NetPrice: row.NetPrice as number,
        Quantity: row.Quantity as number,
        ProductID: row.ProductID as string,
        ProductName: row.ProductName as string,
        Category: row.Category as string,
        Gender: (row.Gender as string) ?? undefined,
      }))
      // Compute locally via API for interactive features
      const { computeRFM, computeTransition } = await import("./lib/api")
      setData({ transactions: txns, rfmData: null, transition: null })
      const [rfm, trans] = await Promise.all([
        computeRFM({ transactions: txns }),
        computeTransition({ transactions: txns, rfmPeriod: [1, "year"], transitionPeriod: [1, "month"] }).catch(() => null),
      ])
      setData((d) => ({ ...d, rfmData: rfm, transition: trans }))
    } catch (e) {
      console.error("Failed to load synthetic data:", e)
    } finally {
      setLoading(false)
    }
  }

  const results = data.rfmData?.results as Array<Record<string, unknown>> | undefined
  const totalCustomers = results?.length ?? 0
  const totalRevenue = results?.reduce((s, r) => s + ((r.TotalSpending as number) ?? 0), 0) ?? 0
  const totalOrders = results?.reduce((s, r) => s + ((r.NoOfTxn as number) ?? 0), 0) ?? 0
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
  const avgRecency = results?.length ? Math.round(results.reduce((s, r) => s + ((r.DaySinceLastTxn as number) ?? 0), 0) / results.length) : 0
  const handleAskChatbot = useCallback((question: string) => {
    setPrefillQuestion(question)
  }, [])

  const segments = data.rfmData?.segments as Array<{ "Number of Customers": number }> | undefined
  const activeSegs = segments?.filter((s) => s["Number of Customers"] > 0).length ?? 0

  const langLabels: Record<Lang, string> = { en: "EN", "zh-TW": "繁中", "zh-CN": "简中" }

  return (
    <div className="flex flex-col h-screen">
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSynthetic5000}
            disabled={loading}
            className="bg-white/15 hover:bg-white/25 text-white text-xs px-2 py-1 rounded disabled:opacity-50"
          >
            {loading ? t.loading : t.loadSynthetic}
          </button>
          {loading ? (
            <span className="text-xs opacity-70 animate-pulse">{t.loading}</span>
          ) : (
            <span className="text-xs opacity-70">{totalCustomers} customers | {totalOrders} orders | ${totalRevenue.toLocaleString()}</span>
          )}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
            className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-xs">
            <option value="en">{langLabels.en}</option>
            <option value="zh-TW">{langLabels["zh-TW"]}</option>
            <option value="zh-CN">{langLabels["zh-CN"]}</option>
          </select>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="sidebar overflow-y-auto">
          <div className="sidebar-header">{t.customerSegmentation}</div>
          <NavLink to="/rfm-overview" className={({ isActive }) => isActive ? "active" : ""}>{t.overview}</NavLink>
          <NavLink to="/rfm-characteristics" className={({ isActive }) => isActive ? "active" : ""}>{t.characteristics}</NavLink>
          <NavLink to="/rfm-transition" className={({ isActive }) => isActive ? "active" : ""}>{t.segmentTransition}</NavLink>
          <NavLink to="/rfm-customer-summary" className={({ isActive }) => isActive ? "active" : ""}>{t.customerSummary}</NavLink>
          <NavLink to="/customer-activity" className={({ isActive }) => isActive ? "active" : ""}>
            {lang === "zh-TW" ? "客戶活動" : lang === "zh-CN" ? "客户活动" : "Customer Activity"}
          </NavLink>
          <NavLink to="/recommend" className={({ isActive }) => isActive ? "active" : ""}>
            {lang === "zh-TW" ? "推薦系統" : lang === "zh-CN" ? "推荐系统" : "Recommender"}
          </NavLink>
          <NavLink to="/qa-500" className={({ isActive }) => isActive ? "active" : ""}>{t.qa500}</NavLink>
          <div className="sidebar-header">{t.whatIfAnalysis}</div>
          <NavLink to="/whatif" className={({ isActive }) => isActive ? "active" : ""}>{t.simulateScenarios}</NavLink>
          <div className="sidebar-header">{t.customerLifetimeValue}</div>
          <NavLink to="/ltv-overview" className={({ isActive }) => isActive ? "active" : ""}>{t.ltvOverview}</NavLink>
        </nav>

        <main className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {[
              [t.totalCustomers, totalCustomers],
              [t.totalRevenue, `$${totalRevenue.toLocaleString()}`],
              ["Total Orders", totalOrders],
              [t.avgOrderValue, `$${avgOrder.toLocaleString()}`],
              ["Avg Recency", `${avgRecency}d`],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-lg p-3 border shadow-sm">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-lg font-bold text-[var(--primary)]">{value}</div>
              </div>
            ))}
          </div>

          <Routes>
            <Route path="/rfm-overview" element={<RFMOverview data={data} />} />
            <Route path="/rfm-characteristics" element={<RFMCharacteristics data={data} />} />
            <Route path="/rfm-transition" element={<RFMTransition data={data} />} />
            <Route path="/rfm-customer-summary" element={<RFMCustomerSummary data={data} />} />
            <Route path="/customer-activity" element={<CustomerActivity data={data} />} />
            <Route path="/recommend" element={<Recommend data={data} />} />
            <Route path="/qa-500" element={<QA500 onAskChatbot={handleAskChatbot} />} />
            <Route path="/whatif" element={<WhatIf data={data} />} />
            <Route path="/ltv-overview" element={<LTVOverview data={data} />} />
            <Route path="*" element={<RFMOverview data={data} />} />
          </Routes>
        </main>

        <ChatBot data={data} lang={lang} prefillQuestion={prefillQuestion} onPrefillConsumed={() => setPrefillQuestion("")} />
      </div>
    </div>
  )
}
