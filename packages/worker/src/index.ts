import {
  computeRFM,
  computeTransition,
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
import type {
  RFMRequest,
  TransitionRequest,
  PredictRequest,
  RFMData,
  WhatIfScenario,
} from "@veil-rfm/core"
import { handleChat } from "./chat"

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
          apiKey?: string
        } = await request.json()

        // API key priority: request body > env secret
        const apiKey = env.QWEN_API_KEY
        if (!apiKey) {
          return error("Server not configured. QWEN_API_KEY secret is missing.", 500)
        }

        return handleChat(
          body.messages as Parameters<typeof handleChat>[0],
          body.transactions ?? [],
          apiKey,
        )
      } catch (e) {
        return error(
          `Chat failed: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    // ── GET /api/health ──
    if (path === "/api/health") {
      return json({ status: "ok", version: "0.1.0" })
    }

    return error("Not found", 404)
  },
}
