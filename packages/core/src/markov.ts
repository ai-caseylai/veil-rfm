import type {
  Transaction,
  RFMData,
  RFMScore,
  RFMSegment,
  MCState,
  TransitionMatrix,
  SegmentMovement,
  TransitionRequest,
  TransitionResponse,
} from "./types"
import { RFM_SEGMENT } from "./types"
import { getRFMData, rfmCompute, rfmSegmentation } from "./rfm"

// ── Time unit helpers ──

type TimeUnit = "year" | "month" | "week" | "day"

function timeUnitToMs(unit: TimeUnit): number {
  switch (unit) {
    case "day":
      return 86_400_000
    case "week":
      return 604_800_000
    case "month":
      return 2_592_000_000 // ~30 days
    case "year":
      return 31_536_000_000 // ~365 days
  }
}

/**
 * Build a list of RFM segment data.tables, one per sliding time window.
 * Port of rfmMC.R::txn2rfmSegmentList()
 */
export function txn2rfmSegmentList(
  transactions: Transaction[],
  rfmPeriod: [number, TimeUnit] = [1, "year"],
  transitionPeriod: [number, TimeUnit] = [1, "month"]
): RFMSegment[][] {
  const [rfmAmount, rfmUnit] = rfmPeriod
  const [transAmount, transUnit] = transitionPeriod

  const timestamps = transactions.map((t) => new Date(t.Timestamp).getTime())
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)

  const rfmPeriodMs = rfmAmount * timeUnitToMs(rfmUnit)
  const transPeriodMs = transAmount * timeUnitToMs(transUnit)

  const beginDate = new Date(minTime + rfmPeriodMs)
  const endDate = new Date(maxTime)
  const absPeriods = Math.abs(
    Math.floor((endDate.getTime() - beginDate.getTime()) / transPeriodMs)
  )

  const segmentList: RFMSegment[][] = []

  // Iterate from -absPeriods to 0 (R's seq handles descending; we use abs + negative)
  for (let i = -absPeriods; i <= 0; i += transAmount) {
    const endRFMDate = new Date(
      endDate.getTime() + i * transPeriodMs
    )
    const beginRFMDate = new Date(
      endRFMDate.getTime() - rfmPeriodMs
    )

    const windowTxns = transactions.filter((t) => {
      const ts = new Date(t.Timestamp).getTime()
      return ts >= beginRFMDate.getTime() && ts <= endRFMDate.getTime()
    })

    const rfmData = getRFMData(windowTxns, endRFMDate)
    if (rfmData.length === 0) {
      segmentList.push([])
      continue
    }
    const rfmScore = rfmCompute(rfmData)
    const rfmSegment = rfmSegmentation(rfmScore)
    segmentList.push(rfmSegment)
  }

  return segmentList
}

/**
 * Merge sequential segment data.frames into a single Markov Chain sequence.
 * Customers that disappear between periods are marked as "Lost Cheap Customers".
 * Port of rfmMC.R::rfmSegment2mcSeq()
 */
export function rfmSegment2mcSeq(
  segmentList: RFMSegment[][]
): MCState[] {
  if (segmentList.length === 0) return []

  // Build a map: CustomerID -> array of segments across periods
  const custStates = new Map<string, (string | null)[]>()

  for (let period = 0; period < segmentList.length; period++) {
    const segMap = new Map(
      segmentList[period].map((s) => [s.CustomerID, s.Segment])
    )
    for (const [custID] of custStates) {
      custStates.get(custID)!.push(segMap.get(custID) ?? null)
    }
    for (const s of segmentList[period]) {
      if (!custStates.has(s.CustomerID)) {
        const arr: (string | null)[] = new Array(period).fill(null)
        arr.push(s.Segment)
        custStates.set(s.CustomerID, arr)
      }
    }
  }

  // Fill gaps: if customer is missing in a period but was present before, mark as Lost
  for (const [, states] of custStates) {
    for (let i = 1; i < states.length; i++) {
      if (states[i] === null && states[i - 1] !== null) {
        states[i] = RFM_SEGMENT[10] // Lost Cheap Customers
      }
    }
  }

  // Melt into long format
  const mcSeq: MCState[] = []
  for (const [custID, states] of custStates) {
    for (let t = 0; t < states.length; t++) {
      if (states[t] !== null) {
        mcSeq.push({ ID: custID, Time: t, State: states[t]! })
      } else {
        mcSeq.push({ ID: custID, Time: t, State: RFM_SEGMENT[10] })
      }
    }
  }

  return mcSeq
}

/**
 * Count transitions between consecutive periods.
 * Port of rfmMC.R::mcSeq2Counts()
 */
export function mcSeq2Counts(
  mcSeq: MCState[],
  stateSpace?: string[]
): TransitionMatrix[] {
  const states = stateSpace ?? RFM_SEGMENT.slice()
  const nStates = states.length
  const stateIdx = new Map(states.map((s, i) => [s, i]))

  const maxTime = Math.max(...mcSeq.map((s) => s.Time))
  const mcCounts: TransitionMatrix[] = []

  for (let t = 1; t <= maxTime; t++) {
    const matrix: TransitionMatrix = Array.from({ length: nStates }, () =>
      new Array(nStates).fill(0)
    )

    const prev = new Map(mcSeq.filter((s) => s.Time === t - 1).map((s) => [s.ID, s.State]))
    const curr = new Map(mcSeq.filter((s) => s.Time === t).map((s) => [s.ID, s.State]))

    for (const [id, fromState] of prev) {
      const toState = curr.get(id)
      if (toState != null) {
        const fi = stateIdx.get(fromState)
        const ti = stateIdx.get(toState)
        if (fi != null && ti != null) {
          matrix[fi][ti]++
        }
      }
    }

    mcCounts.push(matrix)
  }

  return mcCounts
}

/**
 * Normalize transition count matrices to probabilities.
 * Port of rfmMC.R::mcCounts2Prob()
 */
export function mcCounts2Prob(
  mcCounts: TransitionMatrix[],
  stationary = true
): TransitionMatrix {
  if (mcCounts.length === 0) {
    // Return identity matrix as fallback
    const n = RFM_SEGMENT.length
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    )
  }
  const n = mcCounts[0].length

  if (stationary) {
    // Sum all count matrices, then normalize
    const total: TransitionMatrix = Array.from({ length: n }, () =>
      new Array(n).fill(0)
    )
    for (const mat of mcCounts) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          total[i][j] += mat[i][j]
        }
      }
    }
    return normalizeRows(total)
  }

  // Return the latest non-stationary prob matrix
  return normalizeRows(mcCounts[mcCounts.length - 1])
}

function normalizeRows(matrix: TransitionMatrix): TransitionMatrix {
  return matrix.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0)
    return sum > 0 ? row.map((v) => v / sum) : row.map(() => 0)
  })
}

/**
 * Predict segment movement n periods ahead using matrix multiplication.
 * Port of rfmMC.R::predictSegmentMovement()
 */
export function predictSegmentMovement(
  initProp: number[],
  transProb: TransitionMatrix,
  nCustomer: number,
  nperiod = 6
): SegmentMovement[] {
  const n = transProb.length
  let current = [...initProp]

  const result: SegmentMovement[] = []
  // t=0 (initial)
  for (let s = 0; s < n; s++) {
    result.push({
      Time: 0,
      Segment: RFM_SEGMENT[s] ?? `Segment ${s}`,
      Predicted: Math.round(current[s] * nCustomer),
    })
  }

  for (let t = 1; t <= nperiod; t++) {
    const next = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        next[j] += current[i] * transProb[i][j]
      }
    }
    current = next

    for (let s = 0; s < n; s++) {
      result.push({
        Time: t,
        Segment: RFM_SEGMENT[s] ?? `Segment ${s}`,
        Predicted: Math.round(current[s] * nCustomer),
      })
    }
  }

  return result
}

/**
 * Get segment proportions from the latest period of a Markov Chain sequence.
 * Port of rfmMC.R::mcSeq2Prop()
 */
export function mcSeq2Prop(mcSeq: MCState[]): number[] {
  const maxTime = Math.max(...mcSeq.map((s) => s.Time))
  const latestStates = mcSeq
    .filter((s) => s.Time === maxTime)
    .map((s) => s.State)

  const counts = new Map<string, number>()
  for (const state of latestStates) {
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  const total = latestStates.length

  return RFM_SEGMENT.map((seg) => (counts.get(seg) ?? 0) / total)
}

/**
 * Top-level: compute full Markov Chain transition analysis.
 */
export function computeTransition(req: TransitionRequest): TransitionResponse {
  const {
    transactions,
    rfmPeriod = [1, "year"],
    transitionPeriod = [1, "month"],
  } = req

  const segmentList = txn2rfmSegmentList(
    transactions,
    rfmPeriod as [number, TimeUnit],
    transitionPeriod as [number, TimeUnit]
  )
  const mcSeq = rfmSegment2mcSeq(segmentList)
  const mcCounts = mcSeq2Counts(mcSeq)
  const transProb = mcCounts2Prob(mcCounts)

  return { mcSeq, mcCounts, transProb }
}
