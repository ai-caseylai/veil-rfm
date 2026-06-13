import { useEffect, useState, useMemo } from "react"
import { computeRFM } from "../lib/api"
import type { AppData } from "../App"
import { Link, useSearchParams } from "react-router-dom"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }
interface CustomerRow {
  "Customer ID": string; Segment: string; RFM: string; "Recency (days)": number; Orders: number; "Total Spending ($)": number
}

const PAGE_SIZE = 50

function Skeleton() {
  return <div className="card"><div className="card-header"><div className="skeleton h-5 w-48" /></div><div className="card-body"><div className="skeleton h-96 w-full" /></div></div>
}

export default function RFMCustomerSummary({ data }: Props) {
  const { t, lang } = useT()
  const [searchParams] = useSearchParams()
  const segmentFilter = searchParams.get("segment") ?? ""
  const [rfmResult, setRfmResult] = useState<Record<string, unknown> | null>(data.rfmData as Record<string, unknown> | null)
  const [loading, setLoading] = useState(!data.rfmData)
  const [search, setSearch] = useState(segmentFilter)
  const [page, setPage] = useState(0)

  useEffect(() => { if (data.rfmData) { setRfmResult(data.rfmData as Record<string, unknown>); setLoading(false) } }, [data.rfmData])
  useEffect(() => {
    if (rfmResult) return
    setLoading(true)
    computeRFM({ transactions: data.transactions })
      .then(setRfmResult)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [data.transactions])

  const rows = useMemo<CustomerRow[]>(() => {
    if (!rfmResult) return []
    const results = rfmResult.results as { CustomerID: string; Segment: string; DaySinceLastTxn: number; NoOfTxn: number; TotalSpending: number; RecencyScore: number; FrequencyScore: number; MonetaryScore: number }[]
    return results.map((r) => ({
      "Customer ID": r.CustomerID,
      Segment: segLabel(r.Segment, lang),
      RFM: `${r.RecencyScore}${r.FrequencyScore}${r.MonetaryScore}`,
      "Recency (days)": r.DaySinceLastTxn,
      Orders: r.NoOfTxn,
      "Total Spending ($)": r.TotalSpending,
    }))
  }, [rfmResult, lang])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => r["Customer ID"].toLowerCase().includes(q) || r.Segment.toLowerCase().includes(q) || r.RFM.includes(q))
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (loading) return <Skeleton />
  if (!rfmResult) return <p className="text-red-500">{t.errorLoading}</p>

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <span>{t.customerSummary}</span>
        <button onClick={() => {
          const csv = [Object.keys(rows[0] ?? {}).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n")
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `rfm-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        }} className="btn btn-primary text-xs">{t.downloadCSV}</button>
      </div>
      <div className="card-body p-0">
        <div className="p-4 border-b">
          <input type="text" placeholder={t.searchPlaceholder} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.customerID}</th><th>{t.segment}</th><th className="text-center">{t.rfmScore}</th>
                <th className="text-right">{t.recencyDays}</th><th className="text-right">{t.orders}</th><th className="text-right">{t.totalSpending}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r["Customer ID"]}>
                  <td className="mono"><Link to={`/customer/${r["Customer ID"]}`} className="text-[var(--accent)] hover:underline">{r["Customer ID"]}</Link></td>
                  <td>{r.Segment}</td>
                  <td className="text-center mono">{r.RFM}</td>
                  <td className="text-right">{r["Recency (days)"]}</td>
                  <td className="text-right">{r.Orders}</td>
                  <td className="text-right">${r["Total Spending ($)"].toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-3 text-xs text-gray-500 border-t">
          <span>{t.showing} {filtered.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {t.of} {filtered.length}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-secondary text-xs">{t.prev}</button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn btn-secondary text-xs">{t.next}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
