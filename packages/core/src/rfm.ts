import type {
  Transaction,
  RFMData,
  RFMScore,
  RFMSegment,
  RFMResult,
  RFMResponse,
  RFMRequest,
} from "./types"
import { RFM_SEGMENT } from "./types"

// ── Helpers ──

function percentRank(arr: number[], value: number): number {
  const count = arr.filter((v) => v < value).length
  return count / (arr.length - 1 || 1)
}

function percentileRank(values: number[]): number[] {
  return values.map((v) => percentRank(values, v))
}

function findInterval(
  percentile: number,
  percentiles: number[]
): number {
  // Equivalent to R's findInterval with left.open = TRUE
  for (let i = 0; i < percentiles.length; i++) {
    if (percentile < percentiles[i]) return i
  }
  return percentiles.length - 1
}

/**
 * Aggregate raw transactions into RFM per-customer statistics.
 * Port of findRFM.R::getRFMData()
 */
export function getRFMData(
  transactions: Transaction[],
  endDate?: Date
): RFMData[] {
  // First: deduplicate identical rows (same OrderID + MemberID + Timestamp)
  const seen = new Set<string>()
  const uniqueTxns: Transaction[] = []
  for (const t of transactions) {
    const key = `${t.OrderID}|${t.MemberID}|${t.Timestamp}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueTxns.push(t)
    }
  }

  // Then: remove OrderIDs shared across different MemberIDs (ambiguous orders)
  const orderMembers = new Map<string, Set<string>>()
  for (const t of uniqueTxns) {
    const members = orderMembers.get(t.OrderID) ?? new Set()
    members.add(t.MemberID)
    orderMembers.set(t.OrderID, members)
  }
  const dupOrders = new Set(
    [...orderMembers.entries()].filter(([, m]) => m.size > 1).map(([id]) => id)
  )

  // Group by CustomerID
  const priceField = transactions[0]?.NetPrice != null ? "NetPrice" : "TotalPrice"
  const custMap = new Map<string, Transaction[]>()
  for (const t of uniqueTxns) {
    if (dupOrders.has(t.OrderID)) continue
    const arr = custMap.get(t.MemberID) ?? []
    arr.push(t)
    custMap.set(t.MemberID, arr)
  }

  const result: RFMData[] = []
  for (const [custID, txns] of custMap) {
    const dates = txns.map((t) => new Date(t.Timestamp))
    const amounts = txns.map((t) => (t[priceField as keyof Transaction] as number) ?? 0)
    const uniqueOrders = new Set(txns.map((t) => t.OrderID))

    const lastTxnDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    result.push({
      CustomerID: custID,
      DaySinceLastTxn: 0, // filled below
      NoOfTxn: uniqueOrders.size,
      MeanMoneyValue: amounts.reduce((s, a) => s + a, 0) / amounts.length,
      TotalSpending: amounts.reduce((s, a) => s + a, 0),
      Gender: txns[0]?.Gender,
    })
  }

  // Compute DaySinceLastTxn
  const latestDate =
    endDate ?? new Date(Math.max(...result.map((r) => result.length ? 0 : 0)))
  // Actually use the max of all lastTxnDates
  const allLastDates = result.map((r) => {
    const txns = custMap.get(r.CustomerID)!
    return new Date(Math.max(...txns.map((t) => new Date(t.Timestamp).getTime())))
  })
  const maxDate = endDate ?? new Date(Math.max(...allLastDates.map((d) => d.getTime())))

  for (let i = 0; i < result.length; i++) {
    const lastDate = allLastDates[i]
    result[i].DaySinceLastTxn = Math.floor(
      (maxDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  return result
}

/**
 * Compute RFM scores (1–5) for each customer.
 * Port of findRFM.R::rfmCompute()
 */
export function rfmCompute(
  rfmData: RFMData[],
  maxScore = 5,
  recencyWeight = 4,
  frequencyWeight = 4,
  monetaryWeight = 4,
  minTxn = 2
): RFMScore[] {
  const n = rfmData.length
  if (n === 0) return []

  const recencyVals = rfmData.map((d) => -d.DaySinceLastTxn)
  const freqVals = rfmData.map((d) => d.NoOfTxn)
  const monetaryVals = rfmData.map((d) => d.MeanMoneyValue)

  const recencyPercentiles = percentileRank(recencyVals)
  const freqPercentiles = percentileRank(freqVals)
  const monetaryPercentiles = percentileRank(monetaryVals)

  // Build percentile bins: seq(0, 1, length.out = maxScore + 1)[-1]
  const percentiles = Array.from(
    { length: maxScore },
    (_, i) => (i + 1) / maxScore
  )

  function individualScore(percentile: number): number {
    return findInterval(percentile, percentiles) + 1
  }

  // Frequency score with threshold (minTxn)
  const sortedFreq = [...freqVals].sort((a, b) => a - b)

  return rfmData.map((d, i) => {
    const rScore = individualScore(recencyPercentiles[i])

    let fScore: number
    if (d.NoOfTxn <= minTxn) {
      fScore = 1
    } else {
      // remaining get 2..maxScore based on percentile among >minTxn group
      const aboveMin = rfmData.filter((x) => x.NoOfTxn > minTxn)
      const aboveFreq = aboveMin.map((x) => x.NoOfTxn)
      const rank = percentRank(aboveFreq, d.NoOfTxn)
      // Scale to 2..maxScore
      fScore = Math.min(maxScore, 2 + Math.floor(rank * (maxScore - 1)))
      if (fScore < 2) fScore = 2
    }

    const mScore = individualScore(monetaryPercentiles[i])

    const rw = rScore * recencyWeight
    const fw = fScore * frequencyWeight
    const mw = mScore * monetaryWeight
    const finalScore = rw + fw + mw
    const totalWeight = recencyWeight + frequencyWeight + monetaryWeight

    return {
      CustomerID: d.CustomerID,
      RecencyScore: rScore,
      FrequencyScore: fScore,
      MonetaryScore: mScore,
      FinalScore: finalScore,
      RecencyWeightedScore: rw,
      FrequencyWeightedScore: fw,
      MonetaryWeightedScore: mw,
      FinalWeightedScore: finalScore / totalWeight,
    }
  })
}

/**
 * Assign customers to RFM segments (11 groups).
 * Port of findRFM.R::rfmSegmentation()
 */
export function rfmSegmentation(rfmScore: RFMScore[]): RFMSegment[] {
  // Matches R's sequential overwrite pattern in findRFM.R lines 182-209
  // Later assignments overwrite earlier ones for matching rows
  return rfmScore.map((s) => {
    const { RecencyScore: R, FrequencyScore: F, MonetaryScore: M } = s
    let segment: string = RFM_SEGMENT[7] // default: Needs Attention

    // Step 1: Potential Loyalist (R≥3, F≥3, M≥3)
    if (R >= 3 && F >= 3 && M >= 3) segment = RFM_SEGMENT[2]

    // Step 2: Loyal (R≥4, F≥4, M≥4) — overwrites Potential
    if (R >= 4 && F >= 4 && M >= 4) segment = RFM_SEGMENT[1]

    // Step 3: Best (R=5, F=5, M=5) — overwrites Loyal
    if (R === 5 && F === 5 && M === 5) segment = RFM_SEGMENT[0]

    // Step 4: High-spending New (R≥4, F≤2, M≥4)
    if (R >= 4 && F <= 2 && M >= 4) segment = RFM_SEGMENT[4]

    // Step 5: Low-spending Active Loyal (R≥4, F≥4, M≤2)
    if (R >= 4 && F >= 4 && M <= 2) segment = RFM_SEGMENT[3]

    // Step 6: Churned Best (R=1, F≥4, M≥4)
    if (R === 1 && F >= 4 && M >= 4) segment = RFM_SEGMENT[6]

    // Step 7: Almost Lost (R=2-3, F≥4, M≥4) — overwrites Potential for these specific cases
    if ((R === 2 || R === 3) && F >= 4 && M >= 4) segment = RFM_SEGMENT[5]

    // Step 8: About to Sleep (R≤3, F≤3, M≤3)
    if (R <= 3 && F <= 3 && M <= 3) segment = RFM_SEGMENT[8]

    // Step 9: Hibernating (R≤2, F≤2, M≤2) — overwrites About to Sleep
    if (R <= 2 && F <= 2 && M <= 2) segment = RFM_SEGMENT[9]

    // Step 10: Lost Cheap (R=1, F=1, M=1) — overwrites Hibernating
    if (R === 1 && F === 1 && M === 1) segment = RFM_SEGMENT[10]

    return { CustomerID: s.CustomerID, Segment: segment }
  })
}

/**
 * Join RFM data, scores, and segments into full results.
 * Port of findRFM.R::getRFMResults()
 */
export function getRFMResults(
  rfmData: RFMData[],
  rfmScore: RFMScore[],
  rfmSegment: RFMSegment[]
): RFMResult[] {
  const scoreMap = new Map(rfmScore.map((s) => [s.CustomerID, s]))
  const segMap = new Map(rfmSegment.map((s) => [s.CustomerID, s.Segment]))

  return rfmData
    .filter((d) => scoreMap.has(d.CustomerID) && segMap.has(d.CustomerID))
    .map((d) => ({
      CustomerID: d.CustomerID,
      Segment: segMap.get(d.CustomerID)!,
      DaySinceLastTxn: d.DaySinceLastTxn,
      NoOfTxn: d.NoOfTxn,
      TotalSpending: d.TotalSpending,
      RecencyScore: scoreMap.get(d.CustomerID)!.RecencyScore,
      FrequencyScore: scoreMap.get(d.CustomerID)!.FrequencyScore,
      MonetaryScore: scoreMap.get(d.CustomerID)!.MonetaryScore,
      ...(d.Gender ? { Gender: d.Gender } : {}),
    }))
}

/**
 * Get number of customers per segment.
 * Port of findRFM.R::getNoOfCustomersPerSegment()
 */
export function getNoOfCustomersPerSegment(
  rfmData: RFMData[],
  rfmSegment: RFMSegment[]
): { Segment: string; "Number of Customers": number; Percentage: number }[] {
  const segCounts = new Map<string, number>()
  for (const s of rfmSegment) {
    segCounts.set(s.Segment, (segCounts.get(s.Segment) ?? 0) + 1)
  }
  const total = rfmSegment.length

  return RFM_SEGMENT.map((seg) => ({
    Segment: seg,
    "Number of Customers": segCounts.get(seg) ?? 0,
    Percentage: (segCounts.get(seg) ?? 0) / total || 0,
  }))
}

/**
 * Get average statistics per segment.
 * Port of findRFM.R::getAvgStatPerSegment()
 */
export function getAvgStatPerSegment(
  rfmData: RFMData[],
  rfmScore: RFMScore[],
  rfmSegment: RFMSegment[],
  type: "R" | "F" | "M"
): { Segment: string; value: number }[] {
  const results = getRFMResults(rfmData, rfmScore, rfmSegment)
  const segMap = new Map<string, RFMResult[]>()
  for (const r of results) {
    const arr = segMap.get(r.Segment) ?? []
    arr.push(r)
    segMap.set(r.Segment, arr)
  }

  const field =
    type === "R"
      ? "DaySinceLastTxn"
      : type === "F"
        ? "NoOfTxn"
        : "TotalSpending"

  return RFM_SEGMENT.map((seg) => {
    const members = segMap.get(seg) ?? []
    const avg =
      members.length > 0
        ? members.reduce((s, m) => s + (m[field] as number), 0) /
          members.length
        : 0
    return { Segment: seg, value: avg }
  })
}

/**
 * Top-level: compute full RFM analysis from raw transactions.
 */
export function computeRFM(req: RFMRequest): RFMResponse {
  const {
    transactions,
    maxScore = 5,
    recencyWeight = 4,
    frequencyWeight = 4,
    monetaryWeight = 4,
    minTxn = 2,
  } = req

  const rfmData = getRFMData(transactions)
  const rfmScore = rfmCompute(
    rfmData,
    maxScore,
    recencyWeight,
    frequencyWeight,
    monetaryWeight,
    minTxn
  )
  const rfmSegment = rfmSegmentation(rfmScore)
  const results = getRFMResults(rfmData, rfmScore, rfmSegment)

  return { rfmData, rfmScore, rfmSegment, results }
}
