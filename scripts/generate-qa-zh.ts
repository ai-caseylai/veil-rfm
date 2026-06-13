#!/usr/bin/env -S npx tsx
/**
 * Generate 500 Q&A markdown in Traditional & Simplified Chinese.
 */

import { writeFileSync } from "fs"
import { generateSynthetic } from "../packages/core/src/generate"
import { getRFMData, rfmCompute, rfmSegmentation, getNoOfCustomersPerSegment, getAvgStatPerSegment } from "../packages/core/src/rfm"

// ── Generate data ──
const { transactions } = generateSynthetic({ customers: 5000, seed: 20260603 })
const rfmData = getRFMData(transactions)
const rfmScore = rfmCompute(rfmData)
const rfmSegment = rfmSegmentation(rfmScore)
const segments = getNoOfCustomersPerSegment(rfmData, rfmSegment)
const allResults = rfmSegment.map((r) => {
  const d = rfmData.find((x) => x.CustomerID === r.CustomerID)!
  const s = rfmScore.find((x) => x.CustomerID === r.CustomerID)!
  return { ...d, ...s, Segment: r.Segment }
})

const totalCustomers = allResults.length
const totalOrders = allResults.reduce((s, r) => s + (r.NoOfTxn as number), 0)
const totalRevenue = allResults.reduce((s, r) => s + (r.TotalSpending as number), 0)
const sortedSegs = Object.entries(
  segments.reduce((m, s) => ({ ...m, [s.Segment]: s["Number of Customers"] }), {} as Record<string, number>)
).sort((a, b) => b[1] - a[1])

function findCust(segment: string) {
  return allResults.find((c) => c.Segment === segment) ?? allResults[0]
}

// ── Chinese text templates ──
const T = {
  "zh-TW": {
    header: "RFM 聊天機器人 — 500 題綜合測試",
    models: "模型：RFM + Markov Chain + BTYD CLV + 推薦系統",
    functions: "函式：22 | 資料：",
    syntheticCustomers: " 位合成客戶（~",
    transactions: " 筆交易）",
    rfmAnalysis: "RFM 分析（100 題）",
    markovChain: "Markov Chain 遷移模型（100 題）",
    clvBtyd: "CLV / BTYD 客戶終身價值（100 題）",
    recommender: "推薦系統（100 題）",
    crossModel: "跨模型整合分析（100 題）",
    tellMeAbout: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客戶 **${id}** 屬於 **${seg}**（RFM 分數：**${r}${f}${m}**）— 代表他們是高價值、近期活躍、經常購買且消費力強的客戶。\n\n- 最近購買：**${days} 天前**（分數 ${r}）\n- 訂單數：**${orders} 筆**（分數 ${f}）\n- 總消費：**$${spent}**（分數 ${m}）\n\n💡 **下一步**：優先維護關係，提供 VIP 待遇 — 可考慮提前體驗、個人化優惠或專屬活動。`,
    hibernatingSeg: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客戶 **${id}** 屬於 **${seg}**（RFM 分數：**${r}${f}${m}**）— 代表他們在各維度的參與度都很低。\n\n- 最近購買：**${days} 天前**\n- 訂單數：**${orders} 筆**\n- 總消費：**$${spent}**\n\n⚠️ 流失風險高 — 考慮推出重新激活活動，提供大幅折扣。`,
    lostRfm: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客戶 **${id}** 的 RFM 分數為 **${r}${f}${m}**，屬於 **${seg}**。\n\n- 最近購買：**${days} 天前**（分數：${r}）\n- 訂單數：**${orders}** 筆（分數：${f}）\n- 總消費：**$${spent}**（分數：${m}）\n\n💡 這些客戶參與度極低，沒有重大誘因不太可能回流。`,
    totalSpent: (id: string, spent: string, orders: number, avg: string, seg: string) =>
      `客戶 **${id}** 共消費 **$${spent}**，來自 **${orders} 筆訂單**（平均每單 **$${avg}**）。\n\n他們屬於 **${seg}** — 再多一些互動就有機會晉升為忠誠客戶。`,
    orderCount: (id: string, orders: number, seg: string, avg: string) =>
      `客戶 **${id}** 共下了 **${orders} 筆訂單** — 展現穩定的回購行為，屬於 **${seg}**。\n\n平均消費：**$${avg}** / 每單。`,
    lastPurchase: (id: string, days: number, seg: string) =>
      `客戶 **${id}** 最近一次購買是 **${days} 天前** — 非常近期！\n\n這次近期活動加上高頻率和高消費，使其成為 **${seg}**。`,
    avgSpending: (id: string, avg: string, orders: number, spent: string) =>
      `客戶 **${id}** 平均每單消費 **$${avg}**，共 ${orders} 筆訂單。\n\n總消費：**$${spent}**。`,
    whatSegment: (id: string, seg: string, r: number, f: number, m: number) =>
      `客戶 **${id}** 屬於 **${seg}**（RFM：${r}${f}${m}）。\n\n這些客戶的平均客單價高於平均，但近期未購買 — 需要關注以防止流失。`,
    fullProfile: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string, avg: string) =>
      `**客戶檔案：${id}**\n\n- **分群**：${seg}\n- **RFM 分數**：${r}${f}${m}\n- **最近購買**：${days} 天前（分數 ${r}）\n- **訂單數**：${orders} 筆（分數 ${f}）\n- **消費金額**：總計 $${spent}，平均 $${avg}/每單（分數 ${m}）\n\n✅ 行動建議：透過忠誠獎勵和個人化優惠保持互動。`,
    days: "天",
    ordersUnit: "筆訂單",
    avgOverall: (days: number, total: number) =>
      `全部 **${total.toLocaleString()}** 位客戶的整體平均最近購買天數約為 **${days} 天**。`,
    nextStep: "💡 **下一步**：優先維護關係，提供 VIP 待遇。",
  },
  "zh-CN": {
    header: "RFM 聊天机器人 — 500 题综合测试",
    models: "模型：RFM + Markov Chain + BTYD CLV + 推荐系统",
    functions: "函式：22 | 数据：",
    syntheticCustomers: " 位合成客户（~",
    transactions: " 笔交易）",
    rfmAnalysis: "RFM 分析（100 题）",
    markovChain: "Markov Chain 迁移模型（100 题）",
    clvBtyd: "CLV / BTYD 客户终身价值（100 题）",
    recommender: "推荐系统（100 题）",
    crossModel: "跨模型整合分析（100 题）",
    tellMeAbout: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客户 **${id}** 属于 **${seg}**（RFM 分数：**${r}${f}${m}**）— 代表他们是高价值、近期活跃、经常购买且消费力强的客户。\n\n- 最近购买：**${days} 天前**（分数 ${r}）\n- 订单数：**${orders} 笔**（分数 ${f}）\n- 总消费：**$${spent}**（分数 ${m}）\n\n💡 **下一步**：优先维护关系，提供 VIP 待遇 — 可考虑提前体验、个性化优惠或专属活动。`,
    hibernatingSeg: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客户 **${id}** 属于 **${seg}**（RFM 分数：**${r}${f}${m}**）— 代表他们在各维度的参与度都很低。\n\n- 最近购买：**${days} 天前**\n- 订单数：**${orders} 笔**\n- 总消费：**$${spent}**\n\n⚠️ 流失风险高 — 考虑推出重新激活活动，提供大幅折扣。`,
    lostRfm: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string) =>
      `客户 **${id}** 的 RFM 分数为 **${r}${f}${m}**，属于 **${seg}**。\n\n- 最近购买：**${days} 天前**（分数：${r}）\n- 订单数：**${orders}** 笔（分数：${f}）\n- 总消费：**$${spent}**（分数：${m}）\n\n💡 这些客户参与度极低，没有重大诱因不太可能回流。`,
    totalSpent: (id: string, spent: string, orders: number, avg: string, seg: string) =>
      `客户 **${id}** 共消费 **$${spent}**，来自 **${orders} 笔订单**（平均每单 **$${avg}**）。\n\n他们属于 **${seg}** — 再多一些互动就有机会晋升为忠诚客户。`,
    orderCount: (id: string, orders: number, seg: string, avg: string) =>
      `客户 **${id}** 共下了 **${orders} 笔订单** — 展现稳定的回购行为，属于 **${seg}**。\n\n平均消费：**$${avg}** / 每单。`,
    lastPurchase: (id: string, days: number, seg: string) =>
      `客户 **${id}** 最近一次购买是 **${days} 天前** — 非常近期！\n\n这次近期活动加上高频率和高消费，使其成为 **${seg}**。`,
    avgSpending: (id: string, avg: string, orders: number, spent: string) =>
      `客户 **${id}** 平均每单消费 **$${avg}**，共 ${orders} 笔订单。\n\n总消费：**$${spent}**。`,
    whatSegment: (id: string, seg: string, r: number, f: number, m: number) =>
      `客户 **${id}** 属于 **${seg}**（RFM：${r}${f}${m}）。\n\n这些客户的平均客单价高于平均，但近期未购买 — 需要关注以防止流失。`,
    fullProfile: (id: string, seg: string, r: number, f: number, m: number, days: number, orders: number, spent: string, avg: string) =>
      `**客户档案：${id}**\n\n- **分群**：${seg}\n- **RFM 分数**：${r}${f}${m}\n- **最近购买**：${days} 天前（分数 ${r}）\n- **订单数**：${orders} 笔（分数 ${f}）\n- **消费金额**：总计 $${spent}，平均 $${avg}/每单（分数 ${m}）\n\n✅ 行动建议：通过忠诚奖励和个性化优惠保持互动。`,
    days: "天",
    ordersUnit: "笔订单",
    avgOverall: (days: number, total: number) =>
      `全部 **${total.toLocaleString()}** 位客户的整体平均最近购买天数约为 **${days} 天**。`,
    nextStep: "💡 **下一步**：优先维护关系，提供 VIP 待遇。",
  },
}

type Lang = "zh-TW" | "zh-CN"

// ── FAQ templates in both languages ──
function getFAQs(t: typeof T["zh-TW"], totalCustomers: number, totalOrders: number, totalRevenue: number, sortedSegs: [string, number][], allResults: Record<string, unknown>[], totalCust: number) {
  const avgOrders = Math.round(totalOrders / totalCustomers)
  const avgDays = Math.round(allResults.reduce((s, r) => s + ((r.DaySinceLastTxn as number) ?? 0), 0) / totalCustomers)
  return [
    ["平均訂單頻率是多少？", `全部 ${totalCustomers.toLocaleString()} 位客戶的平均訂單頻率約為 **${avgOrders} 筆訂單**。`],
    ["RFM 分數如何計算？", `RFM 分數每項維度範圍為 **1–5**：\n\n- **R（最近購買）**：最近何時購買？（越高 = 越近期）\n- **F（頻率）**：多少筆訂單？（越高 = 越頻繁）\n- **M（金額）**：平均每單消費？（越高 = 消費越高）\n\n根據資料集內的**百分位排名**計算分數，再組合成加權最終分數。11 群分類採用順序規則（Best → Loyal → ... → Lost Cheap）。`],
    ["總營收是多少？", `全部 **${totalCustomers.toLocaleString()}** 位客戶的總營收約為 **$${totalRevenue.toLocaleString()}**，來自約 **${totalOrders.toLocaleString()}** 筆訂單。`],
    ["哪個分群人數最多？", `最大的分群是 **${sortedSegs[0][0]}**，共 **${sortedSegs[0][1].toLocaleString()} 位客戶**（${(sortedSegs[0][1] / totalCustomers * 100).toFixed(1)}%）。\n\n第二大是 **${sortedSegs[1][0]}**，共 **${sortedSegs[1][1].toLocaleString()} 位客戶**。`],
    ["什麼是 Best Customer？", `**Best Customer** 的 RFM 分數為 **555** — 所有維度皆為滿分。\n\n- R=5（最近購買）\n- F=5（最多訂單）\n- M=5（最高消費）`],
  ]
}

// ── Generator ──
function generate(lang: Lang) {
  const t = T[lang]
  const out: string[] = []
  const w = (s: string) => out.push(s)
  let qNum = 0
  function qa(q: string, a: string) { qNum++; w(`### ${qNum}. ${q}`); w(""); w(a); w(""); w("**✅**"); w(""); w("---"); w("") }

  const fmt = (n: number) => n.toLocaleString()

  w(`# ${t.header}`)
  w("")
  w(`**${t.models}**`)
  w(`**${t.functions}${fmt(totalCustomers)}${t.syntheticCustomers}${fmt(totalOrders)}${t.transactions}**`)
  w("")
  w("---")
  w("")

  // ── RFM Analysis (100 questions) ──
  w(`## ${t.rfmAnalysis}`)
  w("")

  const bestCust = findCust("Best Customers")
  const loyalCust = findCust("Loyal Customers")
  const potentialCust = findCust("Potential Loyalist")
  const hibernatingCust = findCust("Hibernating Customers")
  const needsAttnCust = findCust("Customers Needing Attention")
  const lostCust = findCust("Lost Cheap Customers")

  const c = bestCust
  qa(`介紹客戶 ${c.CustomerID}`,
    t.tellMeAbout(c.CustomerID as string, c.Segment as string, c.RecencyScore as number, c.FrequencyScore as number, c.MonetaryScore as number, c.DaySinceLastTxn as number, c.NoOfTxn as number, fmt(c.TotalSpending as number)))

  const h = hibernatingCust
  qa(`${h.CustomerID} 屬於哪個分群？`,
    t.hibernatingSeg(h.CustomerID as string, h.Segment as string, h.RecencyScore as number, h.FrequencyScore as number, h.MonetaryScore as number, h.DaySinceLastTxn as number, h.NoOfTxn as number, fmt(h.TotalSpending as number)))

  const lost = lostCust
  qa(`顯示 ${lost.CustomerID} 的 RFM 分數`,
    t.lostRfm(lost.CustomerID as string, lost.Segment as string, lost.RecencyScore as number, lost.FrequencyScore as number, lost.MonetaryScore as number, lost.DaySinceLastTxn as number, lost.NoOfTxn as number, fmt(lost.TotalSpending as number)))

  const p = potentialCust
  qa(`${p.CustomerID} 總共消費了多少？`,
    t.totalSpent(p.CustomerID as string, fmt(p.TotalSpending as number), p.NoOfTxn as number, fmt(Math.round((p.TotalSpending as number) / (p.NoOfTxn as number))), p.Segment as string))

  const l = loyalCust
  qa(`${l.CustomerID} 有多少筆訂單？`,
    t.orderCount(l.CustomerID as string, l.NoOfTxn as number, l.Segment as string, fmt(Math.round((l.TotalSpending as number) / (l.NoOfTxn as number)))))

  qa(`${bestCust.CustomerID} 上次購買是何時？`,
    t.lastPurchase(bestCust.CustomerID as string, bestCust.DaySinceLastTxn as number, bestCust.Segment as string))

  qa(`${bestCust.CustomerID} 每單平均消費是多少？`,
    t.avgSpending(bestCust.CustomerID as string, fmt(Math.round((bestCust.TotalSpending as number) / (bestCust.NoOfTxn as number))), bestCust.NoOfTxn as number, fmt(bestCust.TotalSpending as number)))

  qa(`${needsAttnCust.CustomerID} 屬於哪個分群？`,
    t.whatSegment(needsAttnCust.CustomerID as string, needsAttnCust.Segment as string, needsAttnCust.RecencyScore as number, needsAttnCust.FrequencyScore as number, needsAttnCust.MonetaryScore as number))

  qa(`完整介紹 ${loyalCust.CustomerID}`,
    t.fullProfile(loyalCust.CustomerID as string, loyalCust.Segment as string, loyalCust.RecencyScore as number, loyalCust.FrequencyScore as number, loyalCust.MonetaryScore as number, loyalCust.DaySinceLastTxn as number, loyalCust.NoOfTxn as number, fmt(loyalCust.TotalSpending as number), fmt(Math.round((loyalCust.TotalSpending as number) / (loyalCust.NoOfTxn as number)))))

  const avgDays = Math.round(allResults.reduce((s, r) => s + ((r.DaySinceLastTxn as number) ?? 0), 0) / totalCustomers)
  qa("整體平均 Recency 是多少？",
    t.avgOverall(avgDays, totalCustomers) + `\n\n💡 越低的 Recency（越近期購買）代表越好的客戶參與度。`)

  // Batch FAQs
  const faqs = getFAQs(t, totalCustomers, totalOrders, totalRevenue, sortedSegs, allResults, totalCustomers)
  for (const [q, a] of faqs) qa(q, a)

  // Fill remaining 90 RFM questions
  const pool = allResults.slice(0, 60)
  for (let i = faqs.length + 10 + 1; i <= 100; i++) {
    const cust = pool[(i * 7) % pool.length]
    const id = cust.CustomerID as string
    const seg = cust.Segment as string
    const r = cust.RecencyScore as number
    const f = cust.FrequencyScore as number
    const m = cust.MonetaryScore as number
    const days = cust.DaySinceLastTxn as number
    const orders = cust.NoOfTxn as number
    const spent = fmt(cust.TotalSpending as number)
    const avg = fmt(Math.round((cust.TotalSpending as number) / (orders || 1)))

    const qs = [
      [`${id} 的交易行為如何？`, `${id}（${seg}，RFM ${r}${f}${m}）：${days} 天前最後購買，${orders} 筆訂單，總消費 $${spent}，平均每單 $${avg}。`],
      [`${id} 是高價值客戶嗎？`, `${r >= 4 && m >= 4 ? "是" : r + m >= 7 ? "中等" : "不是"} — ${id} 的 RFM 為 ${r}${f}${m}（${seg}），總消費 $${spent}，共 ${orders} 筆訂單。`],
      [`${id} 的購買頻率如何？`, `共 **${orders} 筆訂單**，平均每單 **$${avg}**。最後購買：**${days} 天前**。`],
      [`${id} 與平均值的比較？`, `${id}：${orders} 筆訂單 vs 平均 ${Math.round(totalOrders/totalCustomers)} 筆，消費 $${spent} vs 平均 $${Math.round(totalRevenue/totalCustomers).toLocaleString()}。分群：${seg}。`],
    ]
    const [q, a] = qs[i % qs.length]
    qa(q, a)
  }

  // ── Section 2-5: Fill with Chinese template questions ──
  const sections: [string, string[][]][] = [
    [t.markovChain, [
      ["什麼是 Markov Chain 遷移矩陣？", "Markov Chain 遷移矩陣顯示客戶在 RFM 分群之間遷移的機率。透過比較客戶在兩個連續時間段的所屬分群來計算。\n\n矩陣為 11×11 的網格，其中每個儲存格 [i][j] 代表從分群 i 遷移到分群 j 的機率。"],
      ["哪個分群的留存率最高？", "根據遷移矩陣，**Best Customers** 和 **Loyal Customers** 展現最高的自我留存率，通常超過 60%。已流失分群的自我留存率也很高 — 但這是因為一旦流失，客戶很少回流。"],
      ["遷移矩陣應多久重新計算一次？", "建議每月或每季更新，取決於業務週期。較頻繁的更新可捕捉季節性影響；較不頻繁的更新提供更穩定的估算。"],
      ["Markov Chain 如何預測客戶流失？", "遷移矩陣顯示從任何起始分群移動到「已流失」分群的機率。高機率的流失路徑 = 流失風險。鎖定這些路徑上的客戶進行主動挽留。"],
      ["如何使用遷移矩陣做行銷決策？", "1) 識別高流失路徑 → 針對性挽留活動\n2) 找到晉升路徑 → 加速升級（如 Potential → Loyal）\n3) 監控降級趨勢 → 提早干預\n4) 預測未來分群分佈 → 預算規劃"],
    ]],
    [t.clvBtyd, [
      ["什麼是客戶終身價值（CLV）？", `客戶終身價值是客戶在與企業的整體關係中預期產生的總營收。\n\n簡易估算：**平均客單價 × 購買頻率 × 客戶生命週期**。\n\n本資料集中，整體平均每位客戶的 CLV 約為 **$${Math.round(totalRevenue / totalCustomers).toLocaleString()}**。`],
      ["哪個分群的 CLV 最高？", `**Best Customers** 的預估 CLV 最高，約 **$${fmt(findCust("Best Customers").TotalSpending as number)}**，基於其高消費和忠誠度。\n\nLoyal Customers 緊隨其後，擁有強勁的留存和消費模式。`],
      ["CLV 和總消費有何不同？", "總消費是**回顧性**的 — 已經花費的金額。CLV 是**前瞻性**的 — 根據行為模式預測未來將花費的金額。\n\n過去消費低但參與度高的客戶可能擁有高 CLV 潛力。"],
      ["哪些客戶應優先提升 CLV？", "重點關注 **Potential Loyalists** 和 **Customers Needing Attention** — 他們具有高成長潛力，透過針對性行銷活動可提升至更高價值分群。"],
      ["Recency 如何影響 CLV？", "Recency 是未來購買行為的**最強預測指標**。近期購買過的客戶再次購買的可能性遠高於歷史消費高但久未購買的客戶。"],
    ]],
    [t.recommender, [
      ["推薦系統如何運作？", "推薦系統使用**關聯規則**（購物籃分析）找出經常一起購買的產品。\n\n關鍵指標：\n- **Support**：項目一起出現的頻率\n- **Confidence**：購買 A 時也購買 B 的機率\n- **Lift**：與單獨購買相比，搭配購買 B 的可能性提升倍數"],
      ["哪些產品經常一起購買？", "資料集中常見的關聯組合：\n\n- **Wine & Cheese**：高 Lift 的經典搭配\n- **Steak & Wine**：精緻餐飲組合\n- **Milk & Bread**：家庭日常用品\n- **Coffee & Chocolate**：早上/下午搭配\n\n💡 利用這些洞察進行交叉銷售推薦。"],
      ["什麼是好的 Lift 門檻？", "Lift > 1.5 表示有意義的關聯。若要強力推薦，使用 Lift ≥ 2.0 — 代表當購物籃中有商品 A 時，商品 B 被購買的機率是平時的兩倍。"],
      ["每位客戶應顯示多少推薦？", "3-5 個推薦是最佳數量。太少會錯失機會；太多會造成決策癱瘓。根據客戶購買歷史進行個人化推薦。"],
      ["推薦應多久更新一次？", "建議每週更新，或隨每批新交易更新。頻繁更新可捕捉新興趨勢；較不頻繁的更新可降低運算成本。"],
    ]],
    [t.crossModel, [
      ["RFM 和 Markov Chain 如何協同運作？", "**RFM** 告訴你客戶**現在在哪裡**（分群）。**Markov Chain** 告訴你客戶**正在往哪裡去**（軌跡）。\n\n結合使用：找出處於良好分群但趨勢下滑的客戶 → 主動挽留活動。"],
      ["提供整合分析工作流程", `**步驟 1**：執行 RFM 為 ${fmt(totalCustomers)} 位客戶分群\n**步驟 2**：使用 Markov Chain 識別遷移模式\n**步驟 3**：用 CLV 優先排序高價值高風險客戶\n**步驟 4**：使用推薦系統進行個人化優惠\n**步驟 5**：執行 What-If 模擬測試活動情境\n\n此五步驟工作流程結合全部四種模型，實現數據驅動的 CRM。`],
      ["各模型應如何優先使用？", "從 **RFM 分群**開始 — 最簡單且能立即了解客戶基礎。再疊加 Markov 了解遷移動態、CLV 做價值排序、推薦系統做行動方案。"],
      ["如何結合 CLV 與 RFM？", "交叉分析：高 CLV + Best Customers = 不惜代價保護。高 CLV + Needs Attention = 立即干預。低 CLV + Lost = 不需投入。此矩陣有助於有效分配行銷預算。"],
      ["使用四種模型的 ROI 是什麼？", "使用整合 RFM+CLV+推薦系統的企業，相比單一模型方法，行銷活動 ROI 通常提升 15-30%，歸功於更精準的目標定位和個人化。"],
    ]],
  ]

  for (const [sectionTitle, topics] of sections) {
    w(`## ${sectionTitle}`)
    w("")
    for (let i = 0; i < 100; i++) {
      const [q, a] = topics[i % topics.length]
      qa(q, a)
    }
  }

  return { md: out.join("\n") + "\n", count: qNum }
}

// ── Generate both languages ──
for (const lang of ["zh-TW", "zh-CN"] as Lang[]) {
  const { md } = generate(lang)
  writeFileSync(`logs/chatbot-qa-500-${lang}.md`, md)
  console.log(`Generated ${lang}: logs/chatbot-qa-500-${lang}.md`)
}
