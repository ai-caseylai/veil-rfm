import { useEffect, useState, useRef } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts"
import { Network } from "vis-network"
import { DataSet } from "vis-data"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"
import { downloadCSV } from "../lib/export"
import { Link } from "react-router-dom"
import type { AppData } from "../App"
import WhatIf from "../pages/WhatIf"

interface Props { data: AppData }

const COLORS = ["#3182ce","#2b6cb0","#2c5282","#38a169","#2f855a","#d69e2e","#b7791f","#e53e3e","#c53030","#718096","#4a5568"]
const NODE_GROUPS: Record<string, { shape: string; group: string }> = {}
for (let i = 0; i < 3; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "ellipse", group: "Loyal" }
for (let i = 3; i < 5; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "square", group: "Active" }
for (let i = 5; i < 8; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "circle", group: "Losing" }
for (let i = 8; i < 11; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "triangle", group: "Lost" }

function prob2width(p: number, a = 1, b = 4) { return Math.sin((p * Math.PI) / 2) ** 2 * (b - a) + a }

export default function DashboardSections({ data }: Props) {
  const { t, lang } = useT()
  const networkRef = useRef<HTMLDivElement>(null)
  const [whatIfKey, setWhatIfKey] = useState(0)

  // Re-mount WhatIf when data changes
  useEffect(() => setWhatIfKey((k) => k + 1), [data.transactions])

  // ── Transition vis-network ──
  useEffect(() => {
    if (!data.transition || !networkRef.current) return
    const transProb = data.transition.transProb as number[][]
    if (!transProb?.length) return
    const threshold = 0.02; const n = RFM_SEGMENT.length
    const nodes = RFM_SEGMENT.map((seg, i) => ({
      id: i + 1, label: String(i + 1), title: segLabel(seg, lang).replace(/\s+/g, "\n"), value: 20,
      font: { size: 16 }, shape: NODE_GROUPS[seg]?.shape ?? "circle", group: NODE_GROUPS[seg]?.group,
    }))
    const edges: Record<string, unknown>[] = []
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const prob = transProb[i]?.[j] ?? 0
      if (prob <= threshold) continue
      const from = i + 1; const to = j + 1
      let color = "#276749"; let fontColor = "#1a202c"
      if (from === to) { color = "#2b6cb0"; fontColor = "#2b6cb0"; if (i === 10) { color = "#6b46c1"; fontColor = "#6b46c1" } }
      else if (from > to) { color = "#e53e3e"; fontColor = "#e53e3e" }
      edges.push({ from, to, width: prob2width(prob), title: `${segLabel(RFM_SEGMENT[i], lang)} → ${segLabel(RFM_SEGMENT[j], lang)}<br>${(prob * 100).toFixed(1)}%`, label: prob.toFixed(2), color, font: { color: fontColor, size: 14 }, arrows: "to", smooth: true })
    }
    const net = new Network(networkRef.current, { nodes: new DataSet(nodes), edges: new DataSet(edges) }, {
      physics: { solver: "forceAtlas2Based" }, layout: { improvedLayout: true },
      groups: { Loyal: { color: { background: "#38a169", border: "#2f855a" } }, Active: { color: { background: "#3182ce", border: "#2b6cb0" } }, Losing: { color: { background: "#d69e2e", border: "#b7791f" } }, Lost: { color: { background: "#718096", border: "#4a5568" } } },
      interaction: { hover: true, tooltipDelay: 100 },
    })
    return () => net.destroy()
  }, [data.transition])

  if (!data.rfmData) {
    return <div className="flex items-center justify-center h-64"><div className="skeleton h-8 w-64" /></div>
  }

  const rfmData = data.rfmData
  const segments = (rfmData.segments as Array<{ Segment: string; "Number of Customers": number; Percentage: number }>)
    .map((s) => ({ ...s, Segment: segLabel(s.Segment, lang) }))
  const results = rfmData.results as Array<Record<string, unknown>>
  const avgRecency = (rfmData.avgRecency as { Segment: string; value: number }[] ?? [])
    .map((d) => ({ ...d, Segment: segLabel(d.Segment, lang) }))
  const avgFrequency = (rfmData.avgFrequency as { Segment: string; value: number }[] ?? [])
    .map((d) => ({ ...d, Segment: segLabel(d.Segment, lang) }))
  const avgMonetary = (rfmData.avgMonetary as { Segment: string; value: number }[] ?? [])
    .map((d) => ({ ...d, Segment: segLabel(d.Segment, lang) }))
  const total = segments.reduce((s, seg) => s + seg["Number of Customers"], 0)
  const activeSegs = segments.filter((s) => s["Number of Customers"] > 0)

  // Frequency distribution
  const rfmRaw = (rfmData.results ?? rfmData.rfmData ?? []) as Array<{ NoOfTxn: number }>
  const freqDist = new Map<number, number>()
  for (const d of rfmRaw) freqDist.set(d.NoOfTxn, (freqDist.get(d.NoOfTxn) ?? 0) + 1)
  const freqChart = [...freqDist.entries()].sort(([a], [b]) => a - b).map(([orders, count]) => ({ Orders: orders, Customers: count }))

  // Prediction chart
  const predicted = data.transition?.predicted as Array<{ Time: number; Segment: string; Predicted: number }> | undefined
  const timeMap = new Map<number, Record<string, number>>()
  if (predicted) { for (const p of predicted) { const row = timeMap.get(p.Time) ?? {}; row[segLabel(p.Segment, lang)] = p.Predicted; timeMap.set(p.Time, row) } }
  const predChart = [...timeMap.entries()].sort(([a], [b]) => a - b).map(([time, segs]) => ({ time, ...segs }))
  const predSegs = RFM_SEGMENT.map((s) => segLabel(s, lang))

  // LTV data
  const segSpending = new Map<string, number[]>()
  for (const r of results) { const arr = segSpending.get(r.Segment as string) ?? []; arr.push(r.TotalSpending as number); segSpending.set(r.Segment as string, arr) }
  const ltvData = RFM_SEGMENT.map((seg) => {
    const vals = segSpending.get(seg) ?? []
    return { Segment: segLabel(seg, lang), "Avg LTV ($)": vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 }
  }).filter((d) => d["Avg LTV ($)"] > 0)

  return (
    <div className="space-y-4">
      {/* ── 1. RFM Overview: Distribution ── */}
      <section id="distribution" className="card">
        <div className="card-header flex justify-between items-center">
          <span>{t.customersBySegment}</span>
          <button onClick={() => downloadCSV([["Segment","Customers","Percentage"],...segments.map((s) => [s.Segment, String(s["Number of Customers"]), (s.Percentage*100).toFixed(1)+"%"])], "segment-distribution.csv")} className="btn btn-secondary text-xs">{t.downloadCSV}</button>
        </div>
        <div className="card-body">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="flex-1" style={{ minHeight: 380 }}>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie data={activeSegs} dataKey="Number of Customers" nameKey="Segment" cx="50%" cy="50%" outerRadius={130} label={({ Percentage }) => `${((Percentage as number) * 100).toFixed(0)}%`}>
                    {activeSegs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full text-xs">
              <table className="data-table">
                <thead><tr><th className="w-6">#</th><th>{t.segment}</th><th className="text-right">{t.numberOfCustomers}</th><th className="text-right">{t.percentage}</th></tr></thead>
                <tbody>
                  {segments.map((seg, i) => (
                    <tr key={seg.Segment}><td className="text-gray-400">{i + 1}</td><td className="font-medium text-[11px]">{seg.Segment}</td><td className="text-right">{seg["Number of Customers"]}</td><td className="text-right">{(seg.Percentage * 100).toFixed(1)}%</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="font-bold bg-gray-50"><td colSpan={2}>{t.total}</td><td className="text-right">{total}</td><td className="text-right">100%</td></tr></tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. RFM Characteristics ── */}
      <section id="characteristics" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {([
          [lang === "zh-TW" ? "平均 Recency（天）" : lang === "zh-CN" ? "平均 Recency（天）" : "Average Recency (days)", avgRecency, "#3182ce"],
          [lang === "zh-TW" ? "平均訂單數" : lang === "zh-CN" ? "平均订单数" : "Average Orders", avgFrequency, "#38a169"],
          [lang === "zh-TW" ? "平均消費金額（$）" : lang === "zh-CN" ? "平均消费金额（$）" : "Average Spending ($)", avgMonetary, "#d69e2e"],
        ] as const).map(([title, chartData, color]) => (
          <div className="card" key={title}>
            <div className="card-header text-sm">{title}</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.filter((d: { value: number }) => d.value > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="Segment" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </section>

      {/* Orders distribution */}
      <div className="card">
        <div className="card-header">{t.customersByOrders}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={freqChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="Orders" /><YAxis /><Tooltip /><Bar dataKey="Customers" fill="#38a169" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 3. Segment Transition ── */}
      <section id="transition" className="card">
        <div className="card-header">{t.transitionProb}</div>
        <div className="card-body">
          <div className="flex flex-col lg:flex-row">
            <div ref={networkRef} className="flex-1" style={{ minHeight: 520 }} />
            <div className="lg:w-52 text-xs lg:pl-4 lg:border-l lg:ml-4 mt-3 lg:mt-0 space-y-2">
              <div><div className="font-semibold text-gray-500 mb-1">{t.legendGroups}</div>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" /> {lang === "zh-TW" ? "忠誠 (1-3)" : lang === "zh-CN" ? "忠诚 (1-3)" : "Loyal (1-3)"}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-blue-500 mr-1" /> {lang === "zh-TW" ? "活躍 (4-5)" : lang === "zh-CN" ? "活跃 (4-5)" : "Active (4-5)"}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-yellow-500 mr-1" /> {lang === "zh-TW" ? "流失中 (6-8)" : lang === "zh-CN" ? "流失中 (6-8)" : "Losing (6-8)"}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-gray-500 mr-1" /> {lang === "zh-TW" ? "已流失 (9-11)" : lang === "zh-CN" ? "已流失 (9-11)" : "Lost (9-11)"}</p>
              </div>
              <div><div className="font-semibold text-gray-500 mb-1">{lang === "zh-TW" ? "邊線" : lang === "zh-CN" ? "边线" : "Edges"}</div>
                <p><span className="text-blue-600 font-bold">—</span> {lang === "zh-TW" ? "自我循環" : lang === "zh-CN" ? "自我循环" : "Self-loop"}</p>
                <p><span className="text-green-700 font-bold">—</span> {lang === "zh-TW" ? "升級" : lang === "zh-CN" ? "升级" : "Improving"}</p>
                <p><span className="text-red-600 font-bold">—</span> {lang === "zh-TW" ? "降級" : lang === "zh-CN" ? "降级" : "Degrading"}</p>
              </div>
              <div><div className="font-semibold text-gray-500 mb-1">{lang === "zh-TW" ? "分群" : lang === "zh-CN" ? "分群" : "Segments"}</div>
                <ol className="text-[10px] leading-relaxed">{RFM_SEGMENT.map((s, i) => <li key={s}><strong>{i + 1}.</strong> {segLabel(s, lang)}</li>)}</ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prediction chart */}
      {predChart.length > 0 && (
        <div className="card">
          <div className="card-header">{t.predictionChart}</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={predChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="time" /><YAxis scale="log" domain={["auto", "auto"]} /><Tooltip /><Legend />{predSegs.map((seg, i) => <Line key={seg} type="monotone" dataKey={seg} stroke={`hsl(${(i * 33) % 360},60%,45%)`} strokeWidth={2} dot={false} />)}</LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 4. Customer Summary Table ── */}
      <section id="summary" className="card">
        <div className="card-header flex justify-between items-center">
          <span>{t.customerSummary}</span>
          <button onClick={() => {
            const csv = ["Customer ID,Segment,RFM,Recency,Orders,Total Spending", ...results.map((r) => `${r.CustomerID},${r.Segment},${r.RecencyScore}${r.FrequencyScore}${r.MonetaryScore},${r.DaySinceLastTxn},${r.NoOfTxn},${r.TotalSpending}`)].join("\n")
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv])); a.download = `rfm-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
          }} className="btn btn-primary text-xs">{t.downloadCSV}</button>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="data-table">
            <thead><tr><th>{t.customerID}</th><th>{t.segment}</th><th className="text-center">{t.rfmScore}</th><th className="text-right">{t.recencyDays}</th><th className="text-right">{t.orders}</th><th className="text-right">{t.totalSpending}</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={String(r.CustomerID)}><td className="mono"><Link to={`/customer/${r.CustomerID}`} className="text-[var(--accent)] hover:underline">{String(r.CustomerID)}</Link></td><td className="text-xs">{segLabel(String(r.Segment), lang)}</td><td className="text-center mono">{String(r.RecencyScore)}{String(r.FrequencyScore)}{String(r.MonetaryScore)}</td><td className="text-right">{Number(r.DaySinceLastTxn)}</td><td className="text-right">{Number(r.NoOfTxn)}</td><td className="text-right">${Number(r.TotalSpending).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 5. What-If ── */}
      <section id="whatif">
        <WhatIf key={whatIfKey} data={data} />
      </section>

      {/* ── 6. LTV ── */}
      <section id="ltv" className="card">
        <div className="card-header">{t.avgLTVPerSegment}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={ltvData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="Segment" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="Avg LTV ($)" fill="#6b46c1" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
