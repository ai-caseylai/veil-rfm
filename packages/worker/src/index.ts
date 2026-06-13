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
        const body: { transactions: RFMRequest["transactions"] } = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required and must not be empty")
        }
        const cbs = buildCBS(body.transactions)
        const spendData = buildSpendData(body.transactions)
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
        const body: { transactions: RFMRequest["transactions"] } = await request.json()
        if (!body.transactions?.length) {
          return error("transactions array is required and must not be empty")
        }
        const result = computeActivity(body.transactions)
        return json(result)
      } catch (e) {
        return error(`Activity computation failed: ${e instanceof Error ? e.message : String(e)}`)
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

        // Use D1 if available
        if (env.DB) {
          const rawSegments = await getSegmentDistribution(env.DB)
          const totalCust = rawSegments.reduce((s, r) => s + r["Number of Customers"], 0)
          const segments = rawSegments.map((s) => ({
            ...s,
            Percentage: s["Number of Customers"] / totalCust,
          }))
          const avgR = await getAvgRecency(env.DB)
          const avgF = await getAvgFrequency(env.DB)
          const avgM = await getAvgMonetary(env.DB)
          const { results } = await env.DB.prepare("SELECT * FROM customers").all()

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
