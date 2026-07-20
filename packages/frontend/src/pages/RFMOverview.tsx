import { useEffect, useState, useRef, useCallback } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { useNavigate } from "react-router-dom"
import { useT } from "../lib/i18n"
import { segLabel, sortSegments, pieSegLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const COLORS = [
  "#3182ce", "#2b6cb0", "#2c5282", "#38a169", "#2f855a",
  "#d69e2e", "#b7791f", "#e53e3e", "#c53030", "#718096", "#4a5568",
]

const RADIAN = Math.PI / 180

function Skeleton() {
  return (
    <div className="card">
      <div className="card-header"><div className="skeleton h-5 w-48" /></div>
      <div className="card-body">
        <div className="skeleton h-96 w-full mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  )
}

export default function RFMOverview({ data }: Props) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [loading, setLoading] = useState(!data.rfmData)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(420)

  // Track container width for dynamic sizing
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setChartW(entry.contentRect.width)
    })
    ro.observe(el)
    setChartW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { if (data.rfmData) { setRfmResult(data.rfmData as Record<string, unknown>); setLoading(false) } }, [data.rfmData])
  useEffect(() => {
    if (rfmResult) return
    setLoading(true)
    computeRFM({ transactions: data.transactions })
      .then(setRfmResult)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [data.transactions])

  // Dynamic sizing: pie shrinks with container, labels stay proportional
  const outerRadius = Math.max(65, Math.min(chartW * 0.30, 130))
  const labelRadius = outerRadius * 1.32
  const nameSize = Math.max(8.5, outerRadius * 0.085)
  const pctSize = Math.max(9.5, outerRadius * 0.095)
  const chartHeight = Math.max(320, outerRadius * 3.6)
  const pieMargin = { top: outerRadius * 0.15, right: outerRadius * 0.65, bottom: outerRadius * 0.15, left: outerRadius * 0.65 }

  const renderLabel = useCallback((props: Record<string, unknown>) => {
    const pct = props.percent as number
    if (pct < 0.015) return null as unknown as React.ReactElement
    const cx = props.cx as number; const cy = props.cy as number
    const angle = -(props.midAngle as number) * RADIAN
    const x = cx + labelRadius * Math.cos(angle)
    const y = cy + labelRadius * Math.sin(angle)
    const label = (props.ShortName as string) || (props.name as string) || ""
    const anchor = x > cx ? "start" : "end"
    return (
      <text x={x} y={y} fill="#374151" textAnchor={anchor} dominantBaseline="central">
        <tspan fontSize={nameSize} fontWeight={500}>{label}</tspan>
        <tspan x={x} dy={nameSize * 1.3} fontSize={pctSize} fontWeight={700} fill="#1f2937">
          {`${(pct * 100).toFixed(1)}%`}
        </tspan>
      </text>
    )
  }, [labelRadius, nameSize, pctSize])

  if (loading) return <Skeleton />
  if (!rfmResult) return <p className="text-red-500">{t.errorLoading}</p>

  const segments = sortSegments(
    (rfmResult.segments as { Segment: string; "Number of Customers": number; Percentage: number }[])
      .map((s) => ({ ...s, Segment: segLabel(s.Segment, lang), ShortName: pieSegLabel(s.Segment, lang) }))
  )
  const total = segments.reduce((s, seg) => s + seg["Number of Customers"], 0)
  const activeSegs = segments.filter((s) => s["Number of Customers"] > 0)

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">{t.totalCustomers}</div>
          <div className="kpi-value">{total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.activeSegments}</div>
          <div className="kpi-value">{activeSegs.length}/11</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">{t.customersBySegment}</div>
        <div className="card-body">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div ref={chartRef} className="flex-1 pie-chart-wrapper" style={{ minHeight: chartHeight, minWidth: 280 }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart margin={pieMargin}>
                  <Pie
                    data={activeSegs}
                    dataKey="Number of Customers"
                    nameKey="Segment"
                    cx="50%" cy="50%"
                    outerRadius={outerRadius}
                    label={renderLabel}
                    labelLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
                    onClick={(entry) => navigate(`/rfm-customer-summary?segment=${encodeURIComponent(entry.Segment)}`)}
                    style={{ cursor: "pointer" }}
                  >
                    {activeSegs.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 w-full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>{t.segment}</th>
                    <th className="text-right">{t.numberOfCustomers}</th>
                    <th className="text-right">{t.percentage}</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((seg, i) => (
                    <tr key={seg.Segment}>
                      <td className="text-gray-400">{i + 1}</td>
                      <td className="font-medium">{seg.Segment}</td>
                      <td className="text-right">{seg["Number of Customers"]}</td>
                      <td className="text-right">{(seg.Percentage * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={2}>{t.total}</td>
                    <td className="text-right">{total}</td>
                    <td className="text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
