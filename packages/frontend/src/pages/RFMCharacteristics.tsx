import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"

interface Props { data: AppData }
type StatType = "R" | "F" | "M"

function Skeleton() {
  return (
    <div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body"><div className="skeleton h-96 w-full" /></div></div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body"><div className="skeleton h-80 w-full" /></div></div>
    </div>
  )
}

export default function RFMCharacteristics({ data }: Props) {
  const { t } = useT()
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [avgType, setAvgType] = useState<StatType>("R")
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

  const avgKey = avgType === "R" ? "avgRecency" : avgType === "F" ? "avgFrequency" : "avgMonetary"
  const avgData = rfmResult[avgKey] as { Segment: string; value: number }[]
  const avgLabel = avgType === "R" ? t.avgRecency : avgType === "F" ? t.avgOrders : t.avgSpending

  // Frequency distribution
  const rfmData = rfmResult.rfmData as { NoOfTxn: number }[]
  const freqDist = new Map<number, number>()
  for (const d of rfmData) freqDist.set(d.NoOfTxn, (freqDist.get(d.NoOfTxn) ?? 0) + 1)
  const freqChart = [...freqDist.entries()]
    .sort(([a], [b]) => a - b)
    .map(([orders, count]) => ({ Orders: orders, Customers: count }))

  return (
    <div>
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <span>{avgLabel}</span>
          <button onClick={() => setAvgType((t) => t === "R" ? "F" : t === "F" ? "M" : "R")}
            className="btn btn-secondary text-xs">{t.switch_}</button>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={avgData.filter((d) => d.value > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="Segment" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3182ce" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">{t.customersByOrders}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={freqChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="Orders" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Customers" fill="#38a169" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
