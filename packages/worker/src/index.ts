import {
  computeRFM,
  computeTransition,
  computeActivity,
  computeCLV,
  buildCBS,
  buildSpendData,
  recommendForCustomer,
  recommendAll,
  mineAssociationRules,
  predictSegmentMovement,
  mcSeq2Prop,
  mcCounts2Prob,
  txn2rfmSegmentList,
  rfmSegment2mcSeq,
  mcSeq2Counts,
  getNoOfCustomersPerSegment,
  getAvgStatPerSegment,
  whatIfAnalyze,
  whatIfTarget,
} from "@veil-rfm/core"
import {
  generateSynthetic,
  toCSV,
} from "@veil-rfm/core"
import type {
  Transaction,
  RFMRequest,
  TransitionRequest,
  PredictRequest,
  RFMData,
  WhatIfScenario,
} from "@veil-rfm/core"
import { handleChat } from "./chat"
import { getCustomer, searchCustomers, getSegmentDistribution, getAvgRecency, getAvgFrequency, getAvgMonetary } from "./db"
import type { D1Database } from "@cloudflare/workers-types"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}

function error(msg: string, status = 400): Response {
  return json({ error: msg }, status)
}

interface Env {
  QWEN_API_KEY?: string
  DB?: D1Database
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // ── POST /api/rfm ──
    if (path === "/api/rfm" && request.method === "POST") {
      try {
        const body: RFMRequest = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required and must not be empty")
        }
        const result = computeRFM(body)
        const segments = getNoOfCustomersPerSegment(
          result.rfmData,
          result.rfmSegment
        )
        const avgRecency = getAvgStatPerSegment(
          result.rfmData,
          result.rfmScore,
          result.rfmSegment,
          "R"
        )
        const avgFrequency = getAvgStatPerSegment(
          result.rfmData,
          result.rfmScore,
          result.rfmSegment,
          "F"
        )
        const avgMonetary = getAvgStatPerSegment(
          result.rfmData,
          result.rfmScore,
          result.rfmSegment,
          "M"
        )
        return json({
          ...result,
          segments,
          avgRecency,
          avgFrequency,
          avgMonetary,
        })
      } catch (e) {
        return error(
          `RFM computation failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    // ── POST /api/rfm/recommend ──
    if (path === "/api/rfm/recommend" && request.method === "POST") {
      try {
        const body: { customerID?: string; transactions: RFMRequest["transactions"]; topN?: number } = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required")
        }
        if (body.customerID) {
          const result = recommendForCustomer(body.customerID, body.transactions, body.topN ?? 5)
          return json(result ?? { error: "Customer not found" })
        }
        const results = recommendAll(body.transactions, body.topN ?? 5)
        return json(results)
      } catch (e) {
        return error(`Recommend failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/associate ──
    if (path === "/api/rfm/associate" && request.method === "POST") {
      try {
        const body: { transactions: RFMRequest["transactions"]; minSupport?: number; minConfidence?: number } = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required")
        }
        const rules = mineAssociationRules(body.transactions, body.minSupport ?? 0.05, body.minConfidence ?? 0.1)
        return json(rules)
      } catch (e) {
        return error(`Association mining failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/clv ──
    if (path === "/api/rfm/clv" && request.method === "POST") {
      try {
        const body: { transactions: RFMRequest["transactions"]; seed?: number } = await request.json()
        let txns = body.transactions
        if (body.seed && (!txns || txns.length === 0)) {
          txns = generateSynthetic({ customers: 5000, seed: body.seed }).transactions
        }
        if (!txns?.length) {
          return error("transactions array is required and must not be empty")
        }
        const cbs = buildCBS(txns)
        const spendData = buildSpendData(txns)
        if (cbs.length < 3) {
          return error("Need at least 3 customers for BTYD model estimation")
        }
        const result = computeCLV({ cbs, spendData, discountRate: 0.1, margin: 1.0, forecastPeriods: 52 })
        return json(result)
      } catch (e) {
        return error(`CLV computation failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/activity ──
    if (path === "/api/rfm/activity" && request.method === "POST") {
      try {
        const body: { transactions: RFMRequest["transactions"]; seed?: number } = await request.json()
        let txns = body.transactions
        if (body.seed && (!txns || txns.length === 0)) {
          txns = generateSynthetic({ customers: 5000, seed: body.seed }).transactions
        }
        if (!txns?.length) {
          return error("transactions array is required and must not be empty")
        }
        const result = computeActivity(txns)
        return json(result)
      } catch (e) {
        return error(`Activity computation failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/cohort ──
    if (path === "/api/rfm/cohort" && request.method === "POST") {
      try {
        const body: { transactions: RFMRequest["transactions"]; seed?: number } = await request.json()
        let txns = body.transactions
        if (body.seed && (!txns || txns.length === 0)) {
          txns = generateSynthetic({ customers: 5000, seed: body.seed }).transactions
        }
        // Group by first purchase month
        const firstPurchase = new Map<string, string>()
        for (const t of txns) {
          const existing = firstPurchase.get(t.MemberID)
          const ts = t.Timestamp.slice(0, 7)
          if (!existing || ts < existing) firstPurchase.set(t.MemberID, ts)
        }
        // Build cohort matrix
        const cohorts = new Map<string, { size: number; months: Record<number, number> }>()
        for (const [cust, cohortMonth] of firstPurchase) {
          if (!cohorts.has(cohortMonth)) cohorts.set(cohortMonth, { size: 0, months: {} })
          cohorts.get(cohortMonth)!.size++
          // Count activity in subsequent months
          const custTxns = txns.filter((t) => t.MemberID === cust)
          for (const t of custTxns) {
            const tMonth = t.Timestamp.slice(0, 7)
            const cohortDate = new Date(cohortMonth + "-01")
            const txnDate = new Date(tMonth + "-01")
            const monthDiff = (txnDate.getFullYear() - cohortDate.getFullYear()) * 12 + (txnDate.getMonth() - cohortDate.getMonth())
            if (monthDiff > 0) {
              const cohort = cohorts.get(cohortMonth)!
              cohort.months[monthDiff] = (cohort.months[monthDiff] ?? 0) + 1
            }
          }
        }
        // Convert to table rows
        const result = [...cohorts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => {
            const row: Record<string, unknown> = { month, size: data.size }
            for (let m = 1; m <= 6; m++) {
              row[`m${m}`] = (data.months[m] ?? 0) / data.size
            }
            return row
          })
        return json(result)
      } catch (e) {
        return error(`Cohort failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/categories ──
    if (path === "/api/rfm/categories" && request.method === "POST") {
      try {
        const body: { transactions: RFMRequest["transactions"]; seed?: number } = await request.json()
        let txns = body.transactions
        if (body.seed && (!txns || txns.length === 0)) {
          txns = generateSynthetic({ customers: 5000, seed: body.seed }).transactions
        }
        // Get segment for each customer
        const rfmBody: RFMRequest = { transactions: txns }
        const rfmResult = computeRFM(rfmBody)
        const segMap = new Map<string, string>()
        for (const r of rfmResult.results) segMap.set(r.CustomerID, r.Segment)
        // Aggregate spending by segment + category
        const agg = new Map<string, Map<string, number>>()
        for (const t of txns) {
          const seg = segMap.get(t.MemberID) ?? "Unknown"
          if (!agg.has(seg)) agg.set(seg, new Map())
          const catMap = agg.get(seg)!
          catMap.set(t.Category, (catMap.get(t.Category) ?? 0) + t.NetPrice * t.Quantity)
        }
        const result: Record<string, unknown>[] = []
        for (const [seg, cats] of agg) {
          for (const [cat, spending] of cats) {
            result.push({ Segment: seg, Category: cat, Spending: spending })
          }
        }
        return json(result)
      } catch (e) {
        return error(`Categories failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── POST /api/rfm/transition ──
    if (path === "/api/rfm/transition" && request.method === "POST") {
      try {
        const body: TransitionRequest = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required and must not be empty")
        }
        const result = computeTransition(body)

        // Also compute prediction data
        const initProp = mcSeq2Prop(result.mcSeq)
        const totalCustomers = result.mcSeq.filter(
          (s) => s.Time === Math.max(...result.mcSeq.map((x) => x.Time))
        ).length
        const predicted = predictSegmentMovement(
          initProp,
          result.transProb,
          totalCustomers,
          6
        )

        return json({ ...result, initProp, predicted })
      } catch (e) {
        return error(
          `Transition computation failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    // ── POST /api/rfm/predict ──
    if (path === "/api/rfm/predict" && request.method === "POST") {
      try {
        const body: PredictRequest = await request.json()
        if (!body.transProb?.length) {
          return error("transProb matrix is required")
        }
        if (!body.initProp?.length) {
          return error("initProp array is required")
        }
        const predicted = predictSegmentMovement(
          body.initProp,
          body.transProb,
          body.nCustomer,
          body.nperiod ?? 6
        )
        return json({ predictedSegmentMovement: predicted })
      } catch (e) {
        return error(
          `Prediction failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    // ── POST /api/rfm/whatif ──
    if (path === "/api/rfm/whatif" && request.method === "POST") {
      try {
        const body: {
          transactions: RFMRequest["transactions"]
          customerID: string
          scenario: WhatIfScenario
          targetSegment?: string
        } = await request.json()

        const rfmResult = computeRFM({ transactions: body.transactions })
        const allData = rfmResult.rfmData as RFMData[]

        let result
        if (body.targetSegment) {
          result = whatIfTarget(body.customerID, allData, body.targetSegment)
        } else {
          result = whatIfAnalyze(body.customerID, allData, body.scenario ?? {})
        }

        if (!result) return error("Customer not found", 404)
        return json(result)
      } catch (e) {
        return error(
          `What-if analysis failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    // ── POST /api/chat ──
    if (path === "/api/chat" && request.method === "POST") {
      try {
        const body: {
          messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }>
          transactions: RFMRequest["transactions"]
          seed?: number
          apiKey?: string
        } = await request.json()

        // API key priority: request body > env secret
        const apiKey = env.QWEN_API_KEY
        if (!apiKey) {
          return error("Server not configured. QWEN_API_KEY secret is missing.", 500)
        }

        // If seed provided, generate data server-side
        let txns = body.transactions ?? []
        if (body.seed && txns.length === 0) {
          const generated = generateSynthetic({ customers: 5000, seed: body.seed })
          txns = generated.transactions
        }

        return handleChat(
          body.messages as Parameters<typeof handleChat>[0],
          txns,
          apiKey,
        )
      } catch (e) {
        return error(
          `Chat failed: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    // ── GET /api/generate ──
    if (path === "/api/generate" && request.method === "GET") {
      try {
        const n = parseInt(url.searchParams.get("n") ?? "5000")
        const seed = parseInt(url.searchParams.get("seed") ?? "0") || 20260603
        const format = url.searchParams.get("format") ?? "csv"

        if (n < 1 || n > 50000) {
          return error("n must be between 1 and 50000")
        }

        const result = generateSynthetic({ customers: n, seed })

        if (format === "json") {
          return json(result)
        }

        return new Response(toCSV(result.transactions), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="synthetic_${n}_txn.csv"`,
            ...CORS_HEADERS,
          },
        })
      } catch (e) {
        return error(`Generate failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── GET /api/generate/rfm ──
    if (path === "/api/generate/rfm" && request.method === "GET") {
      try {
        const n = parseInt(url.searchParams.get("n") ?? "5000")
        const seed = parseInt(url.searchParams.get("seed") ?? "0") || 20260603

        if (n < 1 || n > 50000) return error("n must be between 1 and 50000")

        const startDate = url.searchParams.get("startDate") ?? ""
        const endDate = url.searchParams.get("endDate") ?? ""
        const offset = parseInt(url.searchParams.get("offset") ?? "0")
        const limit = parseInt(url.searchParams.get("limit") ?? "0")

        // Use D1 if available
        if (env.DB) {
          if (startDate || endDate) {
            // Date-filtered: fetch filtered transactions and recompute RFM
            let sql = "SELECT MemberID, OrderID, Timestamp, NetPrice, Quantity, ProductID, ProductName, Category, Gender FROM transactions WHERE 1=1"
            const params: string[] = []
            if (startDate) { sql += " AND Timestamp >= ?"; params.push(startDate) }
            if (endDate) { sql += " AND Timestamp <= ?"; params.push(endDate + " 23:59:59") }
            const txnRes = await env.DB.prepare(sql).bind(...params).run()
            const txns = txnRes.results as Transaction[]
            if (txns.length < 3) return json({ stats: { customers: 0, orders: 0, rows: 0, elapsedMs: 0 }, rfm: { results: [], segments: [], avgRecency: [], avgFrequency: [], avgMonetary: [] }, transition: {} })

            const body: RFMRequest = { transactions: txns }
            const rfmResult = computeRFM(body)
            const segs = getNoOfCustomersPerSegment(rfmResult.rfmData, rfmResult.rfmSegment)
            const totalC = segs.reduce((s, r) => s + r["Number of Customers"], 0)
            const segments2 = segs.map((s) => ({ ...s, Percentage: s["Number of Customers"] / totalC }))
            const avgR2 = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "R")
            const avgF2 = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "F")
            const avgM2 = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "M")
            const results2 = rfmResult.results.slice(offset, limit > 0 ? offset + limit : undefined)

            return json({
              stats: { customers: totalC, orders: txns.length, rows: txns.length, elapsedMs: 0 },
              rfm: { results: results2, segments: segments2, avgRecency: avgR2, avgFrequency: avgF2, avgMonetary: avgM2 },
              transition: {},
            })
          }

          // Full dataset from D1 (paginated)
          const rawSegments = await getSegmentDistribution(env.DB)
          const totalCust = rawSegments.reduce((s, r) => s + r["Number of Customers"], 0)
          const segments = rawSegments.map((s) => ({ ...s, Percentage: s["Number of Customers"] / totalCust }))
          const avgR = await getAvgRecency(env.DB)
          const avgF = await getAvgFrequency(env.DB)
          const avgM = await getAvgMonetary(env.DB)

          let custSql = "SELECT * FROM customers"
          if (limit > 0) custSql += ` LIMIT ${limit} OFFSET ${offset}`
          const { results } = await env.DB.prepare(custSql).all()

          // Compute transition from a small sample
          const sample = generateSynthetic({ customers: 100, seed })
          const transResult = computeTransition({ transactions: sample.transactions })
          const initProp = mcSeq2Prop(transResult.mcSeq)
          const predicted = predictSegmentMovement(initProp, transResult.transProb, n, 6)

          return json({
            stats: { customers: n, orders: 0, rows: 0, elapsedMs: 0 },
            rfm: { results, segments, avgRecency: avgR, avgFrequency: avgF, avgMonetary: avgM },
            transition: { ...transResult, initProp, predicted },
          })
        }

        // Fallback: generate from scratch
        const generated = generateSynthetic({ customers: n, seed })
        const body: RFMRequest = { transactions: generated.transactions }
        const rfmResult = computeRFM(body)
        const transResult = computeTransition({ transactions: generated.transactions })
        const segments = getNoOfCustomersPerSegment(rfmResult.rfmData, rfmResult.rfmSegment)
        const avgRecency = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "R")
        const avgFrequency = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "F")
        const avgMonetary = getAvgStatPerSegment(rfmResult.rfmData, rfmResult.rfmScore, rfmResult.rfmSegment, "M")
        const initProp = mcSeq2Prop(transResult.mcSeq)
        const totalCust = transResult.mcSeq.filter(
          (s) => s.Time === Math.max(...transResult.mcSeq.map((x) => x.Time))
        ).length
        const predicted = predictSegmentMovement(initProp, transResult.transProb, totalCust, 6)

        return json({
          stats: generated.stats,
          rfm: { ...rfmResult, segments, avgRecency, avgFrequency, avgMonetary },
          transition: { ...transResult, initProp, predicted },
        })
      } catch (e) {
        return error(`Generate+RFM failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── GET /api/customers/:id/transactions ──
    const txnMatch = path.match(/^\/api\/customers\/(.+)\/transactions$/)
    if (txnMatch && request.method === "GET") {
      try {
        if (!env.DB) return error("D1 not configured", 500)
        const { results } = await env.DB.prepare(
          "SELECT OrderID, Timestamp, NetPrice, Quantity, ProductName, Category FROM transactions WHERE MemberID = ? ORDER BY Timestamp DESC LIMIT 200"
        ).bind(txnMatch[1]).run()
        return json(results)
      } catch (e) {
        return error(`Transactions failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── GET /api/customers ──
    if (path === "/api/customers" && request.method === "GET") {
      try {
        if (!env.DB) return error("D1 not configured", 500)
        const segment = url.searchParams.get("segment") ?? undefined
        const search = url.searchParams.get("search") ?? undefined
        const limit = parseInt(url.searchParams.get("limit") ?? "50")
        const results = await searchCustomers(env.DB, { segment, search, limit })
        return json(results)
      } catch (e) {
        return error(`Customers failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ── GET /api/health ──
    if (path === "/api/health") {
      return json({ status: "ok", version: "0.1.0" })
    }

    return error("Not found", 404)
  },
}
