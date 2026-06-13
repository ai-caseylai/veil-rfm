import { Link } from "react-router-dom"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"
import { segLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const COLORS = ["#3182ce", "#2b6cb0", "#2c5282", "#38a169", "#2f855a", "#d69e2e", "#b7791f", "#e53e3e", "#c53030", "#718096", "#4a5568"]

export default function Home({ data }: Props) {
  const { t, lang } = useT()

  if (!data.rfmData) return <div className="flex items-center justify-center h-64"><div className="skeleton h-8 w-64" /></div>

  const segments = (data.rfmData.segments as Array<{ Segment: string; "Number of Customers": number; Percentage: number }> ?? [])
    .map((s) => ({ ...s, Segment: segLabel(s.Segment, lang) }))
  const results = (data.rfmData.results as Array<Record<string, unknown>> ?? [])
  const totalCust = segments.reduce((s, seg) => s + seg["Number of Customers"], 0)
  const totalOrders = results.reduce((s, r) => s + (Number(r.NoOfTxn) ?? 0), 0)
  const totalRevenue = results.reduce((s, r) => s + (Number(r.TotalSpending) ?? 0), 0)
  const activeSegs = segments.filter((s) => s["Number of Customers"] > 0)

  // Top customers
  const topCustomers = [...results]
    .sort((a, b) => (Number(b.TotalSpending) ?? 0) - (Number(a.TotalSpending) ?? 0))
    .slice(0, 5)

  // At-risk segments (hibernating, about to sleep, lost)
  const atRiskSegs = ["Hibernating Customers", "About to Sleep Customers", "Lost Cheap Customers"]
  const atRiskCount = segments.filter((s) => atRiskSegs.includes(s.Segment)).reduce((s, seg) => s + seg["Number of Customers"], 0)

  const quickLinks = [
    { to: "/rfm-overview", icon: "📊", label: t.overview },
    { to: "/rfm-transition", icon: "🔄", label: t.segmentTransition },
    { to: "/whatif", icon: "🔮", label: t.simulateScenarios },
    { to: "/recommend", icon: "🎯", label: lang === "zh-TW" ? "推薦系統" : lang === "zh-CN" ? "推荐系统" : "Recommender" },
    { to: "/qa-500", icon: "💬", label: t.qa500 },
  ]

  return (
    <div className="max-w-6xl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          [t.totalCustomers, totalCust.toLocaleString(), "#3182ce"],
          [lang === "zh-TW" ? "總訂單" : lang === "zh-CN" ? "总订单" : "Total Orders", totalOrders.toLocaleString(), "#38a169"],
          [t.totalRevenue, `$${totalRevenue.toLocaleString()}`, "#d69e2e"],
          [t.activeSegments, `${activeSegs.length}/11`, "#6b46c1"],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Segment Distribution */}
        <div className="card lg:col-span-1">
          <div className="card-header">{t.customersBySegment}</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={activeSegs} dataKey="Number of Customers" nameKey="Segment" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {activeSegs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Link to="/rfm-overview" className="text-xs text-[var(--accent)] hover:underline block text-center mt-2">{t.overview} →</Link>
          </div>
        </div>

        {/* Top Customers */}
        <div className="card lg:col-span-2">
          <div className="card-header flex justify-between items-center">
            <span>{lang === "zh-TW" ? "消費 Top 5" : lang === "zh-CN" ? "消费 Top 5" : "Top 5 by Spending"}</span>
            <Link to="/rfm-customer-summary" className="text-xs text-[var(--accent)] hover:underline">{t.customerSummary} →</Link>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="data-table text-sm">
                <thead><tr><th>#</th><th>{t.customerID}</th><th>{t.segment}</th><th className="text-right">{t.totalSpending}</th><th className="text-right">{t.orders}</th></tr></thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={String(c.CustomerID)}>
                      <td className="text-gray-400">{i + 1}</td>
                      <td><Link to={`/customer/${c.CustomerID}`} className="text-[var(--accent)] hover:underline mono text-xs">{String(c.CustomerID)}</Link></td>
                      <td className="text-xs">{segLabel(String(c.Segment), lang)}</td>
                      <td className="text-right font-medium">${Number(c.TotalSpending).toLocaleString()}</td>
                      <td className="text-right">{Number(c.NoOfTxn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* At-Risk Alert + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alerts */}
        <div className="card lg:col-span-2">
          <div className="card-header">{lang === "zh-TW" ? "風險警示" : lang === "zh-CN" ? "风险警示" : "Risk Alerts"}</div>
          <div className="card-body">
            {atRiskCount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <div>
                    <div className="font-semibold text-red-700 text-sm">
                      {atRiskCount.toLocaleString()} {lang === "zh-TW" ? "位客戶有流失風險" : lang === "zh-CN" ? "位客户有流失风险" : "customers at risk of churn"}
                    </div>
                    <div className="text-xs text-red-600">
                      {lang === "zh-TW" ? "佔總客戶 " : lang === "zh-CN" ? "占总客户 " : "Represents "}
                      {(atRiskCount / totalCust * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                {segments.filter((s) => atRiskSegs.includes(s.Segment) && s["Number of Customers"] > 0).map((s) => (
                  <div key={s.Segment} className="flex justify-between text-xs px-3">
                    <span>{s.Segment}</span>
                    <span className="font-medium">{s["Number of Customers"]} ({(s.Percentage * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-600">✅ {lang === "zh-TW" ? "目前無異常" : lang === "zh-CN" ? "目前无异常" : "All clear — no anomalies detected"}</p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card">
          <div className="card-header">{lang === "zh-TW" ? "快速導覽" : lang === "zh-CN" ? "快速导览" : "Quick Links"}</div>
          <div className="card-body space-y-1">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 text-sm transition-colors">
                <span>{link.icon}</span>
                <span className="text-[var(--primary)]">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
