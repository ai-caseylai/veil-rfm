import { useState, useEffect, useCallback } from "react"
import { Routes, Route, NavLink } from "react-router-dom"
import ChatBot from "./components/ChatBot"
import { SAMPLE_TRANSACTIONS } from "./lib/sampleData"
import { useT } from "./lib/i18n"
import type { Lang } from "./lib/i18n"
import { loadPrecomputedRFM } from "./lib/api"
import type { Transaction } from "@veil-rfm/core"

import RFMOverview from "./pages/RFMOverview"
import RFMCharacteristics from "./pages/RFMCharacteristics"
import RFMTransition from "./pages/RFMTransition"
import RFMCustomerSummary from "./pages/RFMCustomerSummary"
import LTVOverview from "./pages/LTVOverview"
import WhatIf from "./pages/WhatIf"
import CustomerActivity from "./pages/CustomerActivity"
import Recommend from "./pages/Recommend"
import QA500 from "./pages/QA500"
import CustomerDetail from "./pages/CustomerDetail"
import CompareCustomers from "./pages/CompareCustomers"
import Home from "./pages/Home"
import Insights from "./pages/Insights"
import DateFilter from "./components/DateFilter"

export interface AppData {
  transactions: Transaction[]
  rfmData: Record<string, unknown> | null
  transition: Record<string, unknown> | null
}

export default function App() {
  const { t, lang, setLang } = useT()
  const [loading, setLoading] = useState(true)
  const [prefillQuestion, setPrefillQuestion] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [season, setSeason] = useState("20260603") // "20260603" = regular, "20261201" = holiday peak
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [data, setData] = useState<AppData>({
    transactions: SAMPLE_TRANSACTIONS,
    rfmData: null,
    transition: null,
  })

  // Load 5,000-customer RFM data from D1 (single API call)
  useEffect(() => {
    setLoading(true)
    loadPrecomputedRFM({ n: 5000, seed: parseInt(season), startDate: dateFrom, endDate: dateTo, limit: 100 })
      .then((result) => {
        setData((d) => ({
          ...d,
          rfmData: result.rfm,
          transition: result.transition,
        }))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, season])

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
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white text-lg leading-none w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded"
            title="Toggle sidebar"
          >{sidebarOpen ? "◁" : "☰"}</button>
          <h1>{t.appTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs opacity-70 animate-pulse">{t.loading}</span>
          ) : (
            <span className="text-xs opacity-70">{totalCustomers} customers | {totalOrders} orders | ${totalRevenue.toLocaleString()}</span>
          )}
          <select value={season} onChange={(e) => setSeason(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-xs">
            <option value="20260603">{lang === "zh-TW" ? "一般季" : lang === "zh-CN" ? "一般季" : "Regular"}</option>
            <option value="20261201">{lang === "zh-TW" ? "節慶旺季" : lang === "zh-CN" ? "节庆旺季" : "Holiday Peak"}</option>
          </select>
          <DateFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} lang={lang} />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
            className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-xs">
            <option value="en">{langLabels.en}</option>
            <option value="zh-TW">{langLabels["zh-TW"]}</option>
            <option value="zh-CN">{langLabels["zh-CN"]}</option>
          </select>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className={`sidebar overflow-y-auto transition-all duration-200 ${sidebarOpen ? "w-[220px]" : "w-0 overflow-hidden"}`}>
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
          <NavLink to="/compare" className={({ isActive }) => isActive ? "active" : ""}>
            {lang === "zh-TW" ? "客戶比較" : lang === "zh-CN" ? "客户比较" : "Compare"}
          </NavLink>
          <NavLink to="/qa-500" className={({ isActive }) => isActive ? "active" : ""}>{t.qa500}</NavLink>
          <div className="sidebar-header">{lang === "zh-TW" ? "分析洞察" : lang === "zh-CN" ? "分析洞察" : "Insights"}</div>
          <NavLink to="/insights" className={({ isActive }) => isActive ? "active" : ""}>
            {lang === "zh-TW" ? "趨勢與同期群" : lang === "zh-CN" ? "趋势与同期群" : "Trends & Cohorts"}
          </NavLink>
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
            <Route path="/" element={<Home data={data} />} />
            <Route path="/rfm-overview" element={<RFMOverview data={data} />} />
            <Route path="/rfm-characteristics" element={<RFMCharacteristics data={data} />} />
            <Route path="/rfm-transition" element={<RFMTransition data={data} />} />
            <Route path="/rfm-customer-summary" element={<RFMCustomerSummary data={data} />} />
            <Route path="/customer-activity" element={<CustomerActivity data={data} />} />
            <Route path="/recommend" element={<Recommend data={data} />} />
            <Route path="/qa-500" element={<QA500 onAskChatbot={handleAskChatbot} />} />
            <Route path="/customer/:id" element={<CustomerDetail />} />
            <Route path="/compare" element={<CompareCustomers />} />
            <Route path="/insights" element={<Insights data={data} />} />
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
