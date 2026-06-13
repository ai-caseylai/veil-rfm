import { useEffect, useState } from "react"
import type { AppData } from "../App"
import { useT } from "../lib/i18n"
import { prodLabel } from "../lib/segmentNames"

interface Props { data: AppData }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

interface AssociationRule {
  antecedent: string[]
  consequent: string[]
  support: number
  confidence: number
  lift: number
}

const L = {
  title: { en: "Recommender System", "zh-TW": "推薦系統", "zh-CN": "推荐系统" },
  methodA: { en: "A. Item-Based Collaborative Filtering", "zh-TW": "A. 項目協同過濾", "zh-CN": "A. 项目协同过滤" },
  methodADesc: { en: "Personalized Recommendations", "zh-TW": "個人化推薦", "zh-CN": "个性化推荐" },
  methodB: { en: "B. Association Rule Mining", "zh-TW": "B. 關聯規則挖掘", "zh-CN": "B. 关联规则挖掘" },
  methodBDesc: { en: "Association Rules", "zh-TW": "關聯規則", "zh-CN": "关联规则" },
  output: { en: "Output:", "zh-TW": "輸出：", "zh-CN": "输出：" },
  granularity: { en: "Granularity:", "zh-TW": "粒度：", "zh-CN": "粒度：" },
  application: { en: "Application:", "zh-TW": "應用：", "zh-CN": "应用：" },
  computation: { en: "Computation:", "zh-TW": "計算：", "zh-CN": "计算：" },
  outputCF: { en: "Per-customer rec list", "zh-TW": "每位客戶不同", "zh-CN": "每位客户不同" },
  outputAR: { en: "Universal product rules", "zh-TW": "通用商品關聯規則", "zh-CN": "通用商品关联规则" },
  granularityCF: { en: "Personalized", "zh-TW": "個人化推薦清單", "zh-CN": "个性化推荐清单" },
  granularityAR: { en: "All customers", "zh-TW": "適用所有客戶", "zh-CN": "适用所有客户" },
  appCF: { en: "Email product recs", "zh-TW": "Email 個人化推薦", "zh-CN": "Email 个性化推荐" },
  appAR: { en: "Store layout, bundling", "zh-TW": "店內陳列、捆綁促銷", "zh-CN": "店内陈列、捆绑促销" },
  compCF: { en: "Real-time (per customer)", "zh-TW": "即時（對特定客戶）", "zh-CN": "即时（对特定客户）" },
  compAR: { en: "Batch (all rules)", "zh-TW": "批次（全體規則）", "zh-CN": "批次（全体规则）" },
  complementaryFlow: { en: "Complementary Workflow", "zh-TW": "互補應用流程", "zh-CN": "互补应用流程" },
  step1: { en: 'Discovers "Champagne + Lobster" strong association', "zh-TW": "發現「香檳 + 龍蝦」強關聯", "zh-CN": "发现「香槟 + 龙虾」强关联" },
  step2: { en: 'Design "Surf & Turf" bundle promo', "zh-TW": "設計「海陸套餐」促銷", "zh-CN": "设计「海陆套餐」促销" },
  step3: { en: "Recommend Lobster to Champagne buyers", "zh-TW": "對買過香檳的客戶推薦龍蝦", "zh-CN": "对买过香槟的客户推荐龙虾" },
  arTable: { en: "Association Rules", "zh-TW": "關聯規則", "zh-CN": "关联规则" },
  arTableDesc: { en: "Universal rules · Store layout & bundle promos", "zh-TW": "通用商品關聯 · 適合店內陳列、捆綁促銷", "zh-CN": "通用商品关联 · 适合店内陈列、捆绑促销" },
  ifBought: { en: "If Bought", "zh-TW": "購買商品", "zh-CN": "购买商品" },
  likelyBuy: { en: "Likely to Buy", "zh-TW": "可能也會買", "zh-CN": "可能也会买" },
  cfTitle: { en: "Item-Based CF", "zh-TW": "項目協同過濾", "zh-CN": "项目协同过滤" },
  cfDesc: { en: "Personalized · Per customer · Email marketing", "zh-TW": "個人化推薦 · 每位客戶不同 · 適合 Email 行銷", "zh-CN": "个性化推荐 · 每位客户不同 · 适合 Email 营销" },
  purchased: { en: "Purchased:", "zh-TW": "已購買：", "zh-CN": "已购买：" },
  more: { en: "more", "zh-TW": "更多", "zh-CN": "更多" },
  noData: { en: "Not enough data for association rules.", "zh-TW": "關聯規則資料不足。", "zh-CN": "关联规则数据不足。" },
  loadingData: { en: "Loading...", "zh-TW": "載入中...", "zh-CN": "加载中..." },
} as const

export default function Recommend({ data }: Props) {
  const { lang } = useT()
  const l = (key: keyof typeof L) => (L[key] as Record<string, string>)[lang] ?? (L[key] as Record<string, string>).en
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
      <h2 className="text-xl font-semibold mb-4">{l('title')}</h2>

      {/* ── Two Methods Comparison ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card border-l-4 border-blue-500">
          <div className="card-header bg-blue-50">
            <span className="text-blue-700 font-bold">{l('methodA')}</span>
            <span className="text-xs text-gray-400 ml-2">{l('methodADesc')}</span>
          </div>
          <div className="card-body text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-gray-400">{l('output')}</span>{l('outputCF')}</div>
              <div><span className="text-gray-400">{l('granularity')}</span>{l('granularityCF')}</div>
              <div><span className="text-gray-400">{l('application')}</span>{l('appCF')}</div>
              <div><span className="text-gray-400">{l('computation')}</span>{l('compCF')}</div>
            </div>
            <div className="bg-gray-50 rounded p-2 font-mono text-[10px] text-gray-600">
              Score(j) = Σ<sub>i∈P</sub> C[i][j] / Count(i)
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-purple-500">
          <div className="card-header bg-purple-50">
            <span className="text-purple-700 font-bold">{l('methodB')}</span>
            <span className="text-xs text-gray-400 ml-2">{l('methodBDesc')}</span>
          </div>
          <div className="card-body text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-gray-400">{l('output')}</span>{l('outputAR')}</div>
              <div><span className="text-gray-400">{l('granularity')}</span>{l('granularityAR')}</div>
              <div><span className="text-gray-400">{l('application')}</span>{l('appAR')}</div>
              <div><span className="text-gray-400">{l('computation')}</span>{l('compAR')}</div>
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
          <h3 className="font-semibold text-sm mb-2">{l('complementaryFlow')}</h3>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">Association Rules</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">{l('step1')}</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">{l('step2')}</span>
            <span className="text-gray-400">→</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">Collaborative Filtering</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">{l('step3')}</span>
          </div>
        </div>
      </div>

      {/* ── Association Rules Table ── */}
      <div className="card mb-4">
        <div className="card-header">
          B. {l('arTable')} <span className="text-xs text-gray-400 font-normal">— {l('arTableDesc')}</span>
        </div>
        <div className="card-body">
          {rules.length === 0 ? (
            <p className="text-gray-500 text-sm">{l('noData')}</p>
          ) : (
            <div className="overflow-auto max-h-80">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{l('ifBought')}</th>
                    <th>{l('likelyBuy')}</th>
                    <th className="text-right">Support</th>
                    <th className="text-right">Confidence</th>
                    <th className="text-right">Lift ↑</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i}>
                      <td className="font-medium">{r.antecedent.map((p) => prodLabel(p, lang)).join(", ")}</td>
                      <td className="text-purple-700 font-medium">{r.consequent.map((p) => prodLabel(p, lang)).join(", ")}</td>
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
          A. {l('cfTitle')} <span className="text-xs text-gray-400 font-normal">— {l('cfDesc')}</span>
        </div>
        <div className="card-body">
          {allRecs.length === 0 ? (
            <p className="text-gray-500 text-sm">{l('loadingData')}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(allRecs as Array<Record<string, unknown>>).map((rec) => (
                <div key={rec.customerID as string} className="border rounded p-3 hover:border-blue-300 transition-colors">
                  <div className="font-semibold text-sm">{rec.customerID as string}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 mb-2">
                    {l('purchased')} {(rec.purchasedItems as string[])?.slice(0, 4).map((p) => prodLabel(p, lang)).join(", ")}
                    {(rec.purchasedItems as string[])?.length > 4 ? ` +${(rec.purchasedItems as string[]).length - 4} ${l('more')}` : ""}
                  </div>
                  <div className="space-y-1">
                    {(rec.recommendations as Array<{ productName: string; score: number; lift: number }>)?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {prodLabel(item.productName, lang)}
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
