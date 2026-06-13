import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

interface TxnRow { OrderID: string; Timestamp: string; NetPrice: number; Quantity: number; ProductName: string; Category: string }
interface CustInfo { CustomerID: string; Segment: string; RecencyScore: number; FrequencyScore: number; MonetaryScore: number; DaySinceLastTxn: number; NoOfTxn: number; TotalSpending: number; AvgOrderValue: number }

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useT()
  const [cust, setCust] = useState<CustInfo | null>(null)
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [custRes, txnRes] = await Promise.all([
          fetch(`${API_BASE}/api/customers?search=${id}`).then((r) => r.json()),
          fetch(`${API_BASE}/api/customers/${id}/transactions`).then((r) => r.json()),
        ])
        if (Array.isArray(custRes) && custRes.length > 0) setCust(custRes[0] as CustInfo)
        if (Array.isArray(txnRes)) setTxns(txnRes)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <div className="p-6"><div className="skeleton h-6 w-48 mb-4" /><div className="skeleton h-4 w-full mb-2" /></div>

  // Spending by category
  const catSpend = new Map<string, number>()
  let monthlySpend = new Map<string, number>()
  for (const t of txns) {
    catSpend.set(t.Category, (catSpend.get(t.Category) ?? 0) + t.NetPrice * t.Quantity)
    const month = t.Timestamp.slice(0, 7)
    monthlySpend.set(month, (monthlySpend.get(month) ?? 0) + t.NetPrice * t.Quantity)
  }
  const catChart = [...catSpend.entries()].map(([cat, val]) => ({ Category: cat, Spending: Math.round(val) }))
  const monthlyChart = [...monthlySpend.entries()].sort().map(([m, v]) => ({ Month: m, Spending: Math.round(v) }))

  return (
    <div className="max-w-5xl">
      <Link to="/rfm-customer-summary" className="text-xs text-[var(--accent)] hover:underline mb-4 inline-block">← {t.customerSummary}</Link>

      {cust ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {[
              ["Customer ID", cust.CustomerID],
              [t.segment, segLabel(cust.Segment, lang)],
              [t.rfmScore, `${cust.RecencyScore}${cust.FrequencyScore}${cust.MonetaryScore}`],
              [lang === "zh-TW" ? "總消費" : lang === "zh-CN" ? "总消费" : "Total Spending", `$${cust.TotalSpending.toLocaleString()}`],
              [lang === "zh-TW" ? "訂單數" : lang === "zh-CN" ? "订单数" : "Orders", String(cust.NoOfTxn)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-lg p-3 border shadow-sm">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
                <div className="text-lg font-bold text-[var(--primary)]">{value}</div>
              </div>
            ))}
          </div>

          {monthlyChart.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">{lang === "zh-TW" ? "每月消費趨勢" : lang === "zh-CN" ? "每月消费趋势" : "Monthly Spending Trend"}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="Month" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} /><YAxis /><Tooltip /><Bar dataKey="Spending" fill="#3182ce" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="card">
              <div className="card-header">{lang === "zh-TW" ? "消費類別分佈" : lang === "zh-CN" ? "消费类别分布" : "Spending by Category"}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={catChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="Category" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="Spending" fill="#38a169" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header">{lang === "zh-TW" ? "RFM 詳情" : lang === "zh-CN" ? "RFM 详情" : "RFM Details"}</div>
              <div className="card-body text-sm space-y-2">
                {[
                  [lang === "zh-TW" ? "最近購買" : lang === "zh-CN" ? "最近购买" : "Recency", `${cust.DaySinceLastTxn} ${lang === "zh-TW" ? "天前" : lang === "zh-CN" ? "天前" : "days"} (${cust.RecencyScore}/5)`],
                  [lang === "zh-TW" ? "頻率" : lang === "zh-CN" ? "频率" : "Frequency", `${cust.NoOfTxn} ${lang === "zh-TW" ? "筆" : lang === "zh-CN" ? "笔" : "orders"} (${cust.FrequencyScore}/5)`],
                  [lang === "zh-TW" ? "金額" : lang === "zh-CN" ? "金额" : "Monetary", `$${cust.AvgOrderValue.toLocaleString()} /${lang === "zh-TW" ? "單" : lang === "zh-CN" ? "单" : "order"} (${cust.MonetaryScore}/5)`],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-medium">{value}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">{lang === "zh-TW" ? "交易記錄" : lang === "zh-CN" ? "交易记录" : "Transaction History"} ({txns.length})</div>
            <div className="overflow-auto max-h-96">
              <table className="data-table">
                <thead><tr><th>Order ID</th><th>{lang === "zh-TW" ? "日期" : lang === "zh-CN" ? "日期" : "Date"}</th><th>{lang === "zh-TW" ? "產品" : lang === "zh-CN" ? "产品" : "Product"}</th><th>{lang === "zh-TW" ? "類別" : lang === "zh-CN" ? "类别" : "Category"}</th><th className="text-right">Qty</th><th className="text-right">Net Price</th></tr></thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={i}><td className="mono text-xs">{t.OrderID}</td><td className="text-xs">{t.Timestamp.slice(0, 10)}</td><td>{t.ProductName}</td><td className="text-xs text-gray-500">{t.Category}</td><td className="text-right">{t.Quantity}</td><td className="text-right">${t.NetPrice.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-[var(--muted)] py-12">{lang === "zh-TW" ? "找不到客戶" : lang === "zh-CN" ? "找不到客户" : "Customer not found"}: {id}</div>
      )}
    </div>
  )
}
