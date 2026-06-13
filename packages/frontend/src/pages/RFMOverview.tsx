import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const COLORS = [
  "#3182ce", "#2b6cb0", "#2c5282", "#38a169", "#2f855a",
  "#d69e2e", "#b7791f", "#e53e3e", "#c53030", "#718096", "#4a5568",
]

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
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [loading, setLoading] = useState(!rfmResult)

  useEffect(() => {
    if (rfmResult) return
    setLoading(true)
    computeRFM({ transactions: data.transactions })
      .then(setRfmResult)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [data.transactions])

  if (loading) return <Skeleton />
  if (!rfmResult) return <p className="text-red-500">{t.errorLoading}</p>

  const segments = (rfmResult.segments as { Segment: string; "Number of Customers": number; Percentage: number }[])
    .map((s) => ({ ...s, Segment: segLabel(s.Segment, lang) }))
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
            <div className="flex-1" style={{ minHeight: 420 }}>
              <ResponsiveContainer width="100%" height={420}>
                <PieChart>
                  <Pie
                    data={activeSegs}
                    dataKey="Number of Customers"
                    nameKey="Segment"
                    cx="50%" cy="50%"
                    outerRadius={140}
                    label={({ Percentage }) => `${(Percentage * 100).toFixed(1)}%`}
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
