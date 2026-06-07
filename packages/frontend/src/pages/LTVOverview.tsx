import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"

interface Props { data: AppData }

function Skeleton() {
  return <div className="card"><div className="card-header"><div className="skeleton h-5 w-64" /></div><div className="card-body"><div className="skeleton h-96 w-full" /></div></div>
}

export default function LTVOverview({ data }: Props) {
  const { t } = useT()
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

  const results = rfmResult.results as { Segment: string; TotalSpending: number }[]
  const segSpending = new Map<string, number[]>()
  for (const r of results) {
    const arr = segSpending.get(r.Segment) ?? []; arr.push(r.TotalSpending); segSpending.set(r.Segment, arr)
  }
  const chartData = RFM_SEGMENT.map((seg) => {
    const vals = segSpending.get(seg) ?? []
    return { Segment: seg, "Avg LTV ($)": vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 }
  }).filter((d) => d["Avg LTV ($)"] > 0)

  const overallAvg = results.length > 0 ? results.reduce((s, r) => s + r.TotalSpending, 0) / results.length : 0

  return (
    <div>
      <div className="card">
        <div className="card-header">{t.avgLTVPerSegment}</div>
        <div className="card-body">
          <p className="text-sm text-gray-500 mb-4">
            {t.simpleEstimate} {t.overallAvg}: <strong>${overallAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </p>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="Segment" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Avg LTV ($)" fill="#6b46c1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
