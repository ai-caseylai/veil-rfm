import { useEffect, useState } from "react"
import type { AppData } from "../App"

interface Props { data: AppData }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

interface AssociationRule {
  antecedent: string[]
  consequent: string[]
  support: number
  confidence: number
  lift: number
}

export default function Recommend({ data }: Props) {
  const [rules, setRules] = useState<AssociationRule[]>([])
  const [allRecs, setAllRecs] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [rulesRes, recsRes] = await Promise.all([
          fetch(`${API_BASE}/api/rfm/associate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: data.transactions, minSupport: 0.1, minConfidence: 0.1 }),
          }).then((r) => r.json()),
          fetch(`${API_BASE}/api/rfm/recommend`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: data.transactions, topN: 5 }),
          }).then((r) => r.json()),
        ])
        if (!rulesRes.error) setRules(rulesRes)
        if (!recsRes.error) setAllRecs(recsRes)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [data.transactions])

  if (loading) return (
    <div>
      <div className="card"><div className="card-header"><div className="skeleton h-5 w-64" /></div><div className="card-body"><div className="skeleton h-80 w-full" /></div></div>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Recommender System</h2>

      {/* ── Two Methods Comparison ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card border-l-4 border-blue-500">
          <div className="card-header bg-blue-50">
            <span className="text-blue-700 font-bold">A. Item-Based Collaborative Filtering</span>
            <span className="text-xs text-gray-400 ml-2">個人化推薦</span>
          </div>
          <div className="card-body text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-gray-400">輸出：</span>每位客戶不同</div>
              <div><span className="text-gray-400">粒度：</span>個人化推薦清單</div>
              <div><span className="text-gray-400">應用：</span>Email 個人化推薦</div>
              <div><span className="text-gray-400">計算：</span>即時（對特定客戶）</div>
            </div>
            <div className="bg-gray-50 rounded p-2 font-mono text-[10px] text-gray-600">
              Score(j) = Σ<sub>i∈P</sub> C[i][j] / Count(i)
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-purple-500">
          <div className="card-header bg-purple-50">
            <span className="text-purple-700 font-bold">B. Association Rule Mining</span>
            <span className="text-xs text-gray-400 ml-2">關聯規則</span>
          </div>
          <div className="card-body text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-gray-400">輸出：</span>通用商品關聯規則</div>
              <div><span className="text-gray-400">粒度：</span>適用所有客戶</div>
              <div><span className="text-gray-400">應用：</span>店內陳列、捆綁促銷</div>
              <div><span className="text-gray-400">計算：</span>批次（全體規則）</div>
            </div>
            <div className="bg-gray-50 rounded p-2 font-mono text-[10px] text-gray-600">
              Lift(A→B) = P(B|A) / P(B)
            </div>
          </div>
        </div>
      </div>

      {/* Complementary relationship */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 mb-4">
        <div className="card-body">
          <h3 className="font-semibold text-sm mb-2">互補應用流程</h3>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">Association Rules</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">發現「Champagne + Lobster」強關聯</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">設計「海陸套餐」促銷</span>
            <span className="text-gray-400">→</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">Collaborative Filtering</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">對買過 Champagne 的客戶推薦 Lobster</span>
          </div>
        </div>
      </div>

      {/* ── Association Rules Table ── */}
      <div className="card mb-4">
        <div className="card-header">
          B. Association Rules <span className="text-xs text-gray-400 font-normal">— 通用商品關聯 · 適合店內陳列、捆綁促銷</span>
        </div>
        <div className="card-body">
          {rules.length === 0 ? (
            <p className="text-gray-500 text-sm">Not enough data for association rules.</p>
          ) : (
            <div className="overflow-auto max-h-80">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>If Bought（購買）</th>
                    <th>Likely to Buy（可能也會買）</th>
                    <th className="text-right">Support</th>
                    <th className="text-right">Confidence</th>
                    <th className="text-right">Lift ↑</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i}>
                      <td className="font-medium">{r.antecedent.join(", ")}</td>
                      <td className="text-purple-700 font-medium">{r.consequent.join(", ")}</td>
                      <td className="text-right text-xs">{(r.support * 100).toFixed(1)}%</td>
                      <td className="text-right text-xs">{(r.confidence * 100).toFixed(0)}%</td>
                      <td className="text-right font-mono font-bold">{r.lift.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Per-Customer Recommendations ── */}
      <div className="card">
        <div className="card-header">
          A. Item-Based CF <span className="text-xs text-gray-400 font-normal">— 個人化推薦 · 每位客戶不同 · 適合 Email 行銷</span>
        </div>
        <div className="card-body">
          {allRecs.length === 0 ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(allRecs as Array<Record<string, unknown>>).map((rec) => (
                <div key={rec.customerID as string} className="border rounded p-3 hover:border-blue-300 transition-colors">
                  <div className="font-semibold text-sm">{rec.customerID as string}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 mb-2">
                    Purchased: {(rec.purchasedItems as string[])?.slice(0, 4).join(", ")}
                    {(rec.purchasedItems as string[])?.length > 4 ? ` +${(rec.purchasedItems as string[]).length - 4} more` : ""}
                  </div>
                  <div className="space-y-1">
                    {(rec.recommendations as Array<{ productName: string; score: number; lift: number }>)?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {item.productName}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          score: {item.score.toFixed(2)} · lift: {item.lift.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
