import { computeRFM, computeTransition, whatIfAnalyze, whatIfTarget, RFM_SEGMENT } from "@veil-rfm/core"
import type { RFMData, Transaction } from "@veil-rfm/core"

// ── Qwen API (OpenAI-compatible via DashScope International) ──
const QWEN_BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const QWEN_MODEL = "qwen-plus"

// ── All function definitions ──
const FUNCTIONS = [
  {
    type: "function" as const,
    function: {
      name: "getCustomerInfo",
      description: "Get detailed RFM information about a specific customer by ID",
      parameters: {
        type: "object" as const,
        properties: { customerID: { type: "string", description: "Customer ID (e.g., C001)" } },
        required: ["customerID"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listAllCustomers",
      description: "List customers with segments and stats. Sort by spending, orders, or recency.",
      parameters: {
        type: "object" as const,
        properties: {
          sortBy: { type: "string", enum: ["spending", "orders", "recency"], description: "Sort key" },
          limit: { type: "number", description: "Max results, default 10" },
          segment: { type: "string", description: "Optional: filter to a specific segment name" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "runWhatIf",
      description: "Simulate how a customer's segment changes if their recency/frequency/monetary changed",
      parameters: {
        type: "object" as const,
        properties: {
          customerID: { type: "string" },
          recency: { type: "number", description: "New days since last purchase (0=today)" },
          frequency: { type: "number", description: "New number of orders" },
          monetary: { type: "number", description: "New average spending per order" },
        },
        required: ["customerID"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "explainSegment",
      description: "Explain what a specific RFM segment means with business recommendations",
      parameters: {
        type: "object" as const,
        properties: { segmentName: { type: "string" } },
        required: ["segmentName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getSegmentDistribution",
      description: "Get customer count and percentage for each segment",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggestTargetSegment",
      description: "Find what behavioral changes move a customer to a target segment",
      parameters: {
        type: "object" as const,
        properties: { customerID: { type: "string" }, targetSegment: { type: "string" } },
        required: ["customerID", "targetSegment"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getSegmentStats",
      description: "Get average Recency, Frequency, Monetary stats and total revenue per segment",
      parameters: {
        type: "object" as const,
        properties: { segment: { type: "string", description: "Optional: specific segment, or omit for all" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getAtRiskCustomers",
      description: "Find customers at risk of churning (high value but haven't purchased recently)",
      parameters: {
        type: "object" as const,
        properties: { limit: { type: "number", description: "Max results, default 10" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compareCustomers",
      description: "Compare two customers side-by-side on all RFM metrics",
      parameters: {
        type: "object" as const,
        properties: {
          customer1: { type: "string" },
          customer2: { type: "string" },
        },
        required: ["customer1", "customer2"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCustomersByFilter",
      description: "Find customers matching criteria: min/max orders, min/max spending, max recency days",
      parameters: {
        type: "object" as const,
        properties: {
          minOrders: { type: "number" },
          maxOrders: { type: "number" },
          minSpending: { type: "number" },
          maxSpending: { type: "number" },
          maxRecencyDays: { type: "number", description: "Customers who purchased within this many days" },
          segment: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getRevenueBySegment",
      description: "Get total and average revenue contribution per segment, with percentage of overall revenue",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getNewVsReturning",
      description: "Split customers into new (single purchase) vs returning (multiple purchases) with stats",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getSummaryStats",
      description: "Get overall summary: total customers, total revenue, total orders, avg order value, avg recency, avg frequency, avg spending, active segments count",
      parameters: { type: "object" as const, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getSegmentMigration",
      description: "Analyze how customers in a given segment are likely to migrate — show incoming and outgoing transition probabilities",
      parameters: {
        type: "object" as const,
        properties: { segment: { type: "string", description: "Source segment to analyze migration for" } },
        required: ["segment"],
      },
    },
  },
]

const SYSTEM_PROMPT = `You are an RFM (Recency, Frequency, Monetary) analytics AI assistant for a retail business intelligence platform.

## RFM Model
Customers are scored 1-5 on Recency (days since last purchase), Frequency (order count), and Monetary (avg spending per order). Combined scores classify them into 11 segments:
1. Best Customers (555) — VIP, frequent, recent, high spend
2. Loyal Customers (≥444) — consistent repeat buyers
3. Potential Loyalist (≥333) — growing loyalty
4. Low-spending Active Loyal (R≥4,F≥4,M≤2) — frequent but low basket
5. High-spending New (R≥4,M≥4,F≤2) — big first spenders
6. Almost Lost (R=2-3,F≥4,M≥4) — slipping away
7. Churned Best (R=1,F≥4,M≥4) — ex-VIP, urgent win-back
8. Needing Attention (mixed) — investigate further
9. About to Sleep (≤333) — going dormant
10. Hibernating (≤222) — very low engagement
11. Lost Cheap (111) — inactive, minimal value

## Rules
- ALWAYS use function calls when the answer needs data (customer info, segment stats, lists, distributions, what-if, etc.)
- Be concise, data-driven, and business-actionable
- Answer in the user's language (English, 繁體中文, or 简体中文)
- Format numbers with commas: $1,234, 1,500 customers
- Always suggest a concrete next step or business action
- When comparing, highlight the delta clearly
- For at-risk customers, specify urgency level`

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string; type: "function"; function: { name: string; arguments: string }
  }>
}

// ── Helper: compute once ──
function getData(transactions: Transaction[]) {
  const rfm = computeRFM({ transactions })
  return {
    results: rfm.results as Array<Record<string, unknown>>,
    rfmData: rfm.rfmData as RFMData[],
    segments: rfm.segments as Array<Record<string, unknown>>,
  }
}

// ── Function implementations ──

function execGetCustomerInfo(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  const found = results.find((r) => r.CustomerID === args.customerID)
  if (!found) return { error: `Customer ${args.customerID} not found` }
  const spending = (found.TotalSpending as number) ?? 0
  const orders = (found.NoOfTxn as number) ?? 0
  return {
    customerID: found.CustomerID,
    segment: found.Segment,
    rfmScore: `${found.RecencyScore}${found.FrequencyScore}${found.MonetaryScore}`,
    recencyDays: found.DaySinceLastTxn,
    orders,
    totalSpending: spending,
    avgSpendingPerOrder: orders > 0 ? Math.round(spending / orders) : 0,
  }
}

function execListAllCustomers(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  const sortBy = (args.sortBy as string) ?? "spending"
  const limit = Math.min((args.limit as number) ?? 10, 100)
  const segFilter = args.segment as string | undefined
  let filtered = segFilter
    ? results.filter((r) => (r.Segment as string).toLowerCase() === segFilter.toLowerCase())
    : [...results]
  if (sortBy === "spending") filtered.sort((a, b) => ((b.TotalSpending as number) ?? 0) - ((a.TotalSpending as number) ?? 0))
  else if (sortBy === "orders") filtered.sort((a, b) => ((b.NoOfTxn as number) ?? 0) - ((a.NoOfTxn as number) ?? 0))
  else filtered.sort((a, b) => ((a.DaySinceLastTxn as number) ?? 0) - ((b.DaySinceLastTxn as number) ?? 0))
  return {
    total: results.length,
    filtered: filtered.length,
    customers: filtered.slice(0, limit).map((r) => ({
      customerID: r.CustomerID, segment: r.Segment,
      rfm: `${r.RecencyScore}${r.FrequencyScore}${r.MonetaryScore}`,
      orders: r.NoOfTxn, spending: (r.TotalSpending as number) ?? 0, recencyDays: r.DaySinceLastTxn,
    })),
  }
}

function execRunWhatIf(args: Record<string, unknown>, txn: Transaction[]) {
  const { rfmData } = getData(txn)
  const scenario: Record<string, number> = {}
  if (args.recency != null) scenario.recency = args.recency as number
  if (args.frequency != null) scenario.frequency = args.frequency as number
  if (args.monetary != null) scenario.monetary = args.monetary as number
  const result = whatIfAnalyze(args.customerID as string, rfmData, scenario)
  if (!result) return { error: `Customer ${args.customerID} not found` }
  return {
    customerID: result.CustomerID,
    original: { segment: result.original.Segment, rfm: `${result.original.RecencyScore}${result.original.FrequencyScore}${result.original.MonetaryScore}`, orders: result.original.NoOfTxn, spending: result.original.TotalSpending, recencyDays: result.original.DaySinceLastTxn },
    modified: { segment: result.modified.Segment, rfm: `${result.modified.RecencyScore}${result.modified.FrequencyScore}${result.modified.MonetaryScore}`, orders: result.modified.NoOfTxn, spending: result.modified.TotalSpending, recencyDays: result.modified.DaySinceLastTxn },
    segmentChanged: result.original.Segment !== result.modified.Segment,
    deltas: { recency: result.changes.recencyDelta, orders: result.changes.frequencyDelta, avgSpend: result.changes.monetaryDelta },
  }
}

function execExplainSegment(args: Record<string, unknown>) {
  const name = (args.segmentName as string).toLowerCase()
  const idx = RFM_SEGMENT.findIndex((s) => s.toLowerCase() === name)
  if (idx < 0) return { error: `Unknown segment "${args.segmentName}". Available: ${RFM_SEGMENT.join(", ")}` }
  const descs = [
    "Best Customers (RFM 555): Highest value across all dimensions. Action: VIP retention program, exclusive previews, personal shopper service.",
    "Loyal Customers (RFM ≥444): Consistent repeat buyers. Action: loyalty rewards, cross-sell complementary products, referral incentives.",
    "Potential Loyalist (RFM ≥333): Showing loyalty signals. Action: personalized nurture campaigns, milestone rewards to accelerate loyalty.",
    "Low-spending Active Loyal (R≥4,F≥4,M≤2): Frequent but small baskets. Action: bundle deals, upsell at checkout, free-shipping threshold increases.",
    "High-spending New Customers (R≥4,M≥4,F≤2): Big first impression, low return rate. Action: follow-up sequence, category discovery emails, time-limited second-purchase discount.",
    "Almost Lost Customers (R=2-3,F≥4,M≥4): Previously great, slipping away. Action: win-back campaign NOW — personalized offer, 'we miss you' email.",
    "Churned Best Customers (R=1,F≥4,M≥4): Former VIPs gone cold. Action: aggressive win-back — significant incentive, direct outreach, survey why they left.",
    "Customers Needing Attention: Mixed scores, no clear pattern. Action: segment further by category/channel, A/B test different engagement tactics.",
    "About to Sleep (≤333): Trending dormant. Action: re-engagement campaign, time-limited offer, content marketing to stay top-of-mind.",
    "Hibernating (≤222): Very low engagement. Action: low-cost reactivation or deprioritize. Test if discount sensitivity brings them back.",
    "Lost Cheap Customers (111): Inactive, lowest value. Action: minimal marketing spend. If reactivated, likely low ROI.",
  ]
  return { segment: RFM_SEGMENT[idx], rank: idx + 1, description: descs[idx] }
}

function execGetSegmentDistribution(txn: Transaction[]) {
  const { segments } = getData(txn)
  const total = segments.reduce((s: number, seg) => s + ((seg["Number of Customers"] as number) ?? 0), 0)
  return {
    totalCustomers: total,
    segments: segments.filter((s) => (s["Number of Customers"] as number) > 0).map((s) => ({
      segment: s.Segment, customers: s["Number of Customers"], percentage: `${(((s.Percentage as number) ?? 0) * 100).toFixed(1)}%`,
    })),
  }
}

function execSuggestTarget(args: Record<string, unknown>, txn: Transaction[]) {
  const { rfmData } = getData(txn)
  const result = whatIfTarget(args.customerID as string, rfmData, args.targetSegment as string)
  if (!result) return { error: `Could not find path to "${args.targetSegment}" for ${args.customerID}` }
  return {
    customerID: result.CustomerID,
    from: result.original.Segment, to: result.modified.Segment,
    achievable: result.original.Segment !== result.modified.Segment,
    requiredChanges: { recency: `${result.modified.DaySinceLastTxn} days (was ${result.original.DaySinceLastTxn})`, orders: result.modified.NoOfTxn, avgSpend: `$${result.modified.MeanMoneyValue.toFixed(0)}` },
  }
}

function execGetSegmentStats(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  const segFilter = args.segment as string | undefined
  const segMap = new Map<string, Array<Record<string, unknown>>>()
  for (const r of results) {
    const s = r.Segment as string
    if (!segMap.has(s)) segMap.set(s, [])
    segMap.get(s)!.push(r)
  }
  const out: Record<string, unknown>[] = []
  for (const [seg, members] of segMap) {
    if (segFilter && seg.toLowerCase() !== segFilter.toLowerCase()) continue
    const n = members.length
    const avgR = Math.round(members.reduce((s, m) => s + ((m.DaySinceLastTxn as number) ?? 0), 0) / n)
    const avgF = (members.reduce((s, m) => s + ((m.NoOfTxn as number) ?? 0), 0) / n).toFixed(1)
    const avgM = Math.round(members.reduce((s, m) => s + ((m.TotalSpending as number) ?? 0), 0) / n)
    const totalRev = members.reduce((s, m) => s + ((m.TotalSpending as number) ?? 0), 0)
    out.push({ segment: seg, customers: n, avgRecencyDays: avgR, avgOrders: avgF, avgSpending: avgM, totalRevenue: totalRev })
  }
  out.sort((a, b) => (b.totalRevenue as number) - (a.totalRevenue as number))
  return { segments: out }
}

function execGetAtRiskCustomers(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  const limit = Math.min((args.limit as number) ?? 10, 50)
  // At risk = FrequencyScore ≥4 AND MonetaryScore ≥4 AND RecencyScore ≤3 (previously great, now slipping)
  const atRisk = results
    .filter((r) => (r.FrequencyScore as number) >= 4 && (r.MonetaryScore as number) >= 4 && (r.RecencyScore as number) <= 3)
    .sort((a, b) => ((a.RecencyScore as number) ?? 0) - ((b.RecencyScore as number) ?? 0))
  return {
    totalAtRisk: atRisk.length,
    urgencyLevels: {
      critical: atRisk.filter((r) => r.RecencyScore === 1).length,
      high: atRisk.filter((r) => r.RecencyScore === 2).length,
      moderate: atRisk.filter((r) => r.RecencyScore === 3).length,
    },
    customers: atRisk.slice(0, limit).map((r) => ({
      customerID: r.CustomerID, segment: r.Segment, rfm: `${r.RecencyScore}${r.FrequencyScore}${r.MonetaryScore}`, recencyDays: r.DaySinceLastTxn, orders: r.NoOfTxn, spending: (r.TotalSpending as number) ?? 0, urgency: r.RecencyScore === 1 ? "CRITICAL" : r.RecencyScore === 2 ? "HIGH" : "MODERATE",
    })),
  }
}

function execCompareCustomers(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  const c1 = results.find((r) => r.CustomerID === args.customer1)
  const c2 = results.find((r) => r.CustomerID === args.customer2)
  if (!c1 || !c2) return { error: `Customer not found. Available: ${results.map((r) => r.CustomerID).join(", ")}` }
  return {
    customer1: { id: c1.CustomerID, segment: c1.Segment, rfm: `${c1.RecencyScore}${c1.FrequencyScore}${c1.MonetaryScore}`, orders: c1.NoOfTxn, spending: (c1.TotalSpending as number) ?? 0, recencyDays: c1.DaySinceLastTxn },
    customer2: { id: c2.CustomerID, segment: c2.Segment, rfm: `${c2.RecencyScore}${c2.FrequencyScore}${c2.MonetaryScore}`, orders: c2.NoOfTxn, spending: (c2.TotalSpending as number) ?? 0, recencyDays: c2.DaySinceLastTxn },
    comparison: {
      spendingDiff: `$${(((c1.TotalSpending as number) ?? 0) - ((c2.TotalSpending as number) ?? 0)).toLocaleString()}`,
      orderDiff: ((c1.NoOfTxn as number) ?? 0) - ((c2.NoOfTxn as number) ?? 0),
      recencyDiff: `${((c1.DaySinceLastTxn as number) ?? 0) - ((c2.DaySinceLastTxn as number) ?? 0)} days`,
    },
  }
}

function execGetCustomersByFilter(args: Record<string, unknown>, txn: Transaction[]) {
  const { results } = getData(txn)
  let filtered = [...results]
  const minO = args.minOrders as number | undefined
  const maxO = args.maxOrders as number | undefined
  const minS = args.minSpending as number | undefined
  const maxS = args.maxSpending as number | undefined
  const maxR = args.maxRecencyDays as number | undefined
  const seg = args.segment as string | undefined
  const limit = Math.min((args.limit as number) ?? 20, 100)

  if (minO != null) filtered = filtered.filter((r) => ((r.NoOfTxn as number) ?? 0) >= minO)
  if (maxO != null) filtered = filtered.filter((r) => ((r.NoOfTxn as number) ?? 0) <= maxO)
  if (minS != null) filtered = filtered.filter((r) => ((r.TotalSpending as number) ?? 0) >= minS)
  if (maxS != null) filtered = filtered.filter((r) => ((r.TotalSpending as number) ?? 0) <= maxS)
  if (maxR != null) filtered = filtered.filter((r) => ((r.DaySinceLastTxn as number) ?? 999) <= maxR)
  if (seg) filtered = filtered.filter((r) => (r.Segment as string).toLowerCase() === seg.toLowerCase())

  return {
    totalResults: filtered.length,
    filters: { minOrders: minO, maxOrders: maxO, minSpending: minS, maxSpending: maxS, maxRecencyDays: maxR, segment: seg },
    customers: filtered.slice(0, limit).map((r) => ({
      customerID: r.CustomerID, segment: r.Segment, rfm: `${r.RecencyScore}${r.FrequencyScore}${r.MonetaryScore}`, orders: r.NoOfTxn, spending: (r.TotalSpending as number) ?? 0, recencyDays: r.DaySinceLastTxn,
    })),
  }
}

function execGetRevenueBySegment(txn: Transaction[]) {
  const { results } = getData(txn)
  const segMap = new Map<string, { count: number; totalRev: number }>()
  let grandTotal = 0
  for (const r of results) {
    const s = r.Segment as string
    const rev = (r.TotalSpending as number) ?? 0
    grandTotal += rev
    const entry = segMap.get(s) ?? { count: 0, totalRev: 0 }
    entry.count++; entry.totalRev += rev
    segMap.set(s, entry)
  }
  const out = [...segMap.entries()].map(([seg, v]) => ({
    segment: seg, customers: v.count, totalRevenue: v.totalRev,
    avgRevenuePerCustomer: Math.round(v.totalRev / v.count),
    percentOfTotalRevenue: grandTotal > 0 ? `${((v.totalRev / grandTotal) * 100).toFixed(1)}%` : "0%",
  }))
  out.sort((a, b) => b.totalRevenue - a.totalRevenue)
  return { grandTotalRevenue: grandTotal, segments: out }
}

function execGetNewVsReturning(txn: Transaction[]) {
  const { results } = getData(txn)
  const newCust = results.filter((r) => ((r.NoOfTxn as number) ?? 0) === 1)
  const returning = results.filter((r) => ((r.NoOfTxn as number) ?? 0) > 1)
  const newRev = newCust.reduce((s, r) => s + ((r.TotalSpending as number) ?? 0), 0)
  const retRev = returning.reduce((s, r) => s + ((r.TotalSpending as number) ?? 0), 0)
  const total = results.length
  return {
    newCustomers: { count: newCust.length, percentage: `${((newCust.length / total) * 100).toFixed(1)}%`, totalRevenue: newRev, avgSpending: newCust.length > 0 ? Math.round(newRev / newCust.length) : 0 },
    returningCustomers: { count: returning.length, percentage: `${((returning.length / total) * 100).toFixed(1)}%`, totalRevenue: retRev, avgSpending: returning.length > 0 ? Math.round(retRev / returning.length) : 0, avgOrders: returning.length > 0 ? (returning.reduce((s, r) => s + ((r.NoOfTxn as number) ?? 0), 0) / returning.length).toFixed(1) : "0" },
  }
}

function execGetSummaryStats(txn: Transaction[]) {
  const { results, segments } = getData(txn)
  const totalCustomers = results.length
  const totalRevenue = results.reduce((s, r) => s + ((r.TotalSpending as number) ?? 0), 0)
  const totalOrders = results.reduce((s, r) => s + ((r.NoOfTxn as number) ?? 0), 0)
  const avgRecency = Math.round(results.reduce((s, r) => s + ((r.DaySinceLastTxn as number) ?? 0), 0) / totalCustomers)
  const avgOrders = (totalOrders / totalCustomers).toFixed(1)
  const avgSpending = Math.round(totalRevenue / totalCustomers)
  const activeSegs = segments.filter((s) => (s["Number of Customers"] as number) > 0).length
  return { totalCustomers, totalRevenue, totalOrders, avgOrderValue: Math.round(totalRevenue / totalOrders), avgRecencyDays: avgRecency, avgOrdersPerCustomer: avgOrders, avgSpendingPerCustomer: avgSpending, activeSegments: `${activeSegs}/11` }
}

function execGetSegmentMigration(args: Record<string, unknown>, txn: Transaction[]) {
  const segName = args.segment as string
  const idx = RFM_SEGMENT.findIndex((s) => s.toLowerCase() === segName.toLowerCase())
  if (idx < 0) return { error: `Unknown segment "${segName}"` }
  let transProb: number[][] = []
  try {
    const result = computeTransition({ transactions: txn, rfmPeriod: [1, "year"], transitionPeriod: [1, "month"] })
    transProb = result.transProb as number[][]
  } catch { /* fallback */ }

  if (transProb.length === 0) {
    return { segment: segName, message: "Not enough data for transition analysis (need at least 2 time periods of data)." }
  }

  const outgoing: { to: string; probability: string }[] = []
  const incoming: { from: string; probability: string }[] = []
  for (let j = 0; j < RFM_SEGMENT.length; j++) {
    if (transProb[idx][j] > 0.01) outgoing.push({ to: RFM_SEGMENT[j], probability: `${(transProb[idx][j] * 100).toFixed(1)}%` })
    if (transProb[j][idx] > 0.01) incoming.push({ from: RFM_SEGMENT[j], probability: `${(transProb[j][idx] * 100).toFixed(1)}%` })
  }
  outgoing.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability))
  incoming.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability))
  return { segment: RFM_SEGMENT[idx], retentionRate: `${(transProb[idx][idx] * 100).toFixed(1)}%`, topOutgoing: outgoing.slice(0, 5), topIncoming: incoming.slice(0, 5) }
}

// ── Main chat handler ──

let txnsCache: Transaction[] = []

export async function handleChat(
  messages: ChatMessage[],
  transactions: Transaction[],
  apiKey: string,
): Promise<Response> {
  txnsCache = transactions

  try {

  if (!messages.some((m) => m.role === "system")) {
    messages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
  }

  let loopCount = 0
  while (loopCount < 5) {
    loopCount++
    const qwenRes = await fetch(`${QWEN_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: QWEN_MODEL, messages, tools: FUNCTIONS, tool_choice: "auto", temperature: 0.3 }),
    })

    if (!qwenRes.ok) {
      return new Response(JSON.stringify({ error: `Qwen API error: ${qwenRes.status} ${await qwenRes.text().catch(() => "")}` }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
    }

    const completion = (await qwenRes.json()) as { choices: Array<{ message: ChatMessage; finish_reason: string }> }
    const msg = completion.choices[0]?.message
    if (!msg) return new Response(JSON.stringify({ reply: "No response." }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })

    if (msg.tool_calls?.length) {
      messages.push(msg)
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments) } catch { /* */ }
        let result: unknown
        switch (tc.function.name) {
          case "getCustomerInfo": result = execGetCustomerInfo(args, txnsCache); break
          case "listAllCustomers": result = execListAllCustomers(args, txnsCache); break
          case "runWhatIf": result = execRunWhatIf(args, txnsCache); break
          case "explainSegment": result = execExplainSegment(args); break
          case "getSegmentDistribution": result = execGetSegmentDistribution(txnsCache); break
          case "suggestTargetSegment": result = execSuggestTarget(args, txnsCache); break
          case "getSegmentStats": result = execGetSegmentStats(args, txnsCache); break
          case "getAtRiskCustomers": result = execGetAtRiskCustomers(args, txnsCache); break
          case "compareCustomers": result = execCompareCustomers(args, txnsCache); break
          case "getCustomersByFilter": result = execGetCustomersByFilter(args, txnsCache); break
          case "getRevenueBySegment": result = execGetRevenueBySegment(txnsCache); break
          case "getNewVsReturning": result = execGetNewVsReturning(txnsCache); break
          case "getSummaryStats": result = execGetSummaryStats(txnsCache); break
          case "getSegmentMigration": result = execGetSegmentMigration(args, txnsCache); break
          default: result = { error: `Unknown function: ${tc.function.name}` }
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) })
      }
      continue
    }

    return new Response(JSON.stringify({ reply: msg.content || "" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
  }

  return new Response(JSON.stringify({ reply: "Processing loop limit reached. Please try a simpler query." }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })

  } catch (e) {
    return new Response(JSON.stringify({ error: `Chat handler error: ${e instanceof Error ? e.message : String(e)}` }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
  }
}
