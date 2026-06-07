import { useEffect, useState, useRef } from "react"
import { Network } from "vis-network"
import { DataSet } from "vis-data"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { computeTransition } from "../lib/api"
import type { AppData } from "../App"
import { RFM_SEGMENT } from "@veil-rfm/core"
import { useT } from "../lib/i18n"

interface Props { data: AppData }

const NODE_GROUPS: Record<string, { shape: string; group: string }> = {}
for (let i = 0; i < 3; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "ellipse", group: "Loyal" }
for (let i = 3; i < 5; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "square", group: "Active" }
for (let i = 5; i < 8; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "circle", group: "Losing" }
for (let i = 8; i < 11; i++) NODE_GROUPS[RFM_SEGMENT[i]] = { shape: "triangle", group: "Lost" }

function prob2width(p: number, a = 1, b = 4): number {
  return Math.sin((p * Math.PI) / 2) ** 2 * (b - a) + a
}

function Skeleton() {
  return (
    <div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-64" /></div><div className="card-body"><div className="skeleton h-[600px] w-full" /></div></div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body"><div className="skeleton h-96 w-full" /></div></div>
    </div>
  )
}

export default function RFMTransition({ data }: Props) {
  const { t } = useT()
  const [transition, setTransition] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const networkRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    computeTransition({
      transactions: data.transactions,
      rfmPeriod: [1, "year"],
      transitionPeriod: [1, "month"],
    })
      .then(setTransition)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [data.transactions])

  useEffect(() => {
    if (!transition || !networkRef.current) return

    const transProb = transition.transProb as number[][]
    const threshold = 0.02
    const n = RFM_SEGMENT.length

    const nodes = RFM_SEGMENT.map((seg, i) => ({
      id: i + 1,
      label: String(i + 1),
      title: seg.replace(/\s+/g, "\n"),
      value: 20,
      font: { size: 16 },
      shape: NODE_GROUPS[seg]?.shape ?? "circle",
      group: NODE_GROUPS[seg]?.group,
    }))

    const edges: Record<string, unknown>[] = []
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const prob = transProb[i][j]
        if (prob <= threshold) continue
        const from = i + 1; const to = j + 1
        const fromName = RFM_SEGMENT[i]; const toName = RFM_SEGMENT[j]
        let color = "#276749"; let fontColor = "#1a202c"
        if (from === to) { color = "#2b6cb0"; fontColor = "#2b6cb0"
          if (fromName === RFM_SEGMENT[10]) { color = "#6b46c1"; fontColor = "#6b46c1" }
        } else if (from > to) { color = "#e53e3e"; fontColor = "#e53e3e" }

        edges.push({ from, to, width: prob2width(prob), title: `${fromName} → ${toName}<br>Probability: ${(prob * 100).toFixed(2)}%`, label: prob.toFixed(2), color, font: { color: fontColor, size: 14 }, arrows: "to", smooth: true })
      }
    }

    const net = new Network(networkRef.current, { nodes: new DataSet(nodes), edges: new DataSet(edges) }, {
      physics: { solver: "forceAtlas2Based" },
      layout: { improvedLayout: true },
      groups: {
        Loyal: { color: { background: "#38a169", border: "#2f855a" } },
        Active: { color: { background: "#3182ce", border: "#2b6cb0" } },
        Losing: { color: { background: "#d69e2e", border: "#b7791f" } },
        Lost: { color: { background: "#718096", border: "#4a5568" } },
      },
      interaction: { hover: true, tooltipDelay: 100 },
    })
    return () => net.destroy()
  }, [transition])

  if (loading) return <Skeleton />
  if (!transition) return <p className="text-red-500">{t.errorLoading}</p>

  const predicted = transition.predicted as { Time: number; Segment: string; Predicted: number }[]
  const timeMap = new Map<number, Record<string, number>>()
  for (const p of predicted) { const row = timeMap.get(p.Time) ?? {}; row[p.Segment] = p.Predicted; timeMap.set(p.Time, row) }
  const predChart = [...timeMap.entries()].sort(([a], [b]) => a - b).map(([time, segs]) => ({ time, ...segs }))

  return (
    <div>
      <div className="card">
        <div className="card-header">{t.transitionProb}</div>
        <div className="card-body">
          <div className="flex">
            <div ref={networkRef} className="flex-1" style={{ height: 600 }} />
            <div className="w-52 text-xs pl-4 border-l ml-4 space-y-3">
              <div>
                <div className="font-semibold text-gray-500 mb-1">{t.legendGroups}</div>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" /> {t.loyal}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-blue-500 mr-1" /> {t.active}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-yellow-500 mr-1" /> {t.losing}</p>
                <p><span className="inline-block w-3 h-3 rounded-sm bg-gray-500 mr-1" /> {t.lost}</p>
              </div>
              <div>
                <div className="font-semibold text-gray-500 mb-1">{t.legendEdges}</div>
                <p><span className="text-blue-600 font-bold">—</span> {t.selfLoop}</p>
                <p><span className="text-green-700 font-bold">—</span> {t.improving}</p>
                <p><span className="text-red-600 font-bold">—</span> {t.degrading}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">{t.segmentReference}</div>
        <div className="card-body">
          <ol className="text-sm grid grid-cols-2 gap-x-6 gap-y-1">
            {RFM_SEGMENT.map((seg, i) => (
              <li key={seg} className="flex gap-2">
                <span className="text-gray-400 font-mono min-w-[20px]">{i + 1}.</span>
                <span>{seg}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card">
        <div className="card-header">{t.predictionChart}</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={460}>
            <LineChart data={predChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" label={{ value: t.period, position: "bottom" }} />
              <YAxis scale="log" domain={["auto", "auto"]} label={{ value: t.predictedCustomers, angle: -90, position: "left" }} />
              <Tooltip />
              <Legend />
              {RFM_SEGMENT.map((seg, i) => (
                <Line key={seg} type="monotone" dataKey={seg} stroke={`hsl(${(i * 33) % 360}, 60%, 45%)`} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
