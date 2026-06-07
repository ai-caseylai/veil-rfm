import type { RFMData, RFMScore, RFMSegment } from "./types"
import { rfmCompute, rfmSegmentation } from "./rfm"

export interface WhatIfScenario {
  recency?: number    // new DaySinceLastTxn (0 = today)
  frequency?: number  // new NoOfTxn
  monetary?: number   // new MeanMoneyValue
}

export interface WhatIfResult {
  CustomerID: string
  original: {
    DaySinceLastTxn: number
    NoOfTxn: number
    MeanMoneyValue: number
    TotalSpending: number
    Segment: string
    RecencyScore: number
    FrequencyScore: number
    MonetaryScore: number
  }
  modified: {
    DaySinceLastTxn: number
    NoOfTxn: number
    MeanMoneyValue: number
    TotalSpending: number
    Segment: string
    RecencyScore: number
    FrequencyScore: number
    MonetaryScore: number
  }
  changes: {
    recencyDelta: number
    frequencyDelta: number
    monetaryDelta: number
  }
}

/**
 * Simulate how a customer's RFM segment would change if their behavior changed.
 * Re-computes the full RFM with the modified customer to get accurate percentile scores
 * within the context of all other customers.
 */
export function whatIfAnalyze(
  customerID: string,
  allRFMData: RFMData[],
  scenario: WhatIfScenario
): WhatIfResult | null {
  const customer = allRFMData.find((d) => d.CustomerID === customerID)
  if (!customer) return null

  // Build modified RFMData array — replace the target customer
  const newFrequency = scenario.frequency ?? customer.NoOfTxn
  const newMonetary = scenario.monetary ?? customer.MeanMoneyValue
  const newTotalSpending = (scenario.monetary != null || scenario.frequency != null)
    ? newMonetary * newFrequency
    : customer.TotalSpending

  const modifiedCustomer: RFMData = {
    ...customer,
    DaySinceLastTxn: scenario.recency ?? customer.DaySinceLastTxn,
    NoOfTxn: newFrequency,
    MeanMoneyValue: newMonetary,
    TotalSpending: newTotalSpending,
  }

  const modifiedData = allRFMData.map((d) =>
    d.CustomerID === customerID ? modifiedCustomer : d
  )

  // Re-compute scores with the modified data
  const originalScores = rfmCompute(allRFMData)
  const modifiedScores = rfmCompute(modifiedData)
  const originalSegments = rfmSegmentation(originalScores)
  const modifiedSegments = rfmSegmentation(modifiedScores)

  const origScore = originalScores.find((s) => s.CustomerID === customerID)!
  const modScore = modifiedScores.find((s) => s.CustomerID === customerID)!
  const origSeg = originalSegments.find((s) => s.CustomerID === customerID)!
  const modSeg = modifiedSegments.find((s) => s.CustomerID === customerID)!

  return {
    CustomerID: customerID,
    original: {
      DaySinceLastTxn: customer.DaySinceLastTxn,
      NoOfTxn: customer.NoOfTxn,
      MeanMoneyValue: customer.MeanMoneyValue,
      TotalSpending: customer.TotalSpending,
      Segment: origSeg.Segment,
      RecencyScore: origScore.RecencyScore,
      FrequencyScore: origScore.FrequencyScore,
      MonetaryScore: origScore.MonetaryScore,
    },
    modified: {
      DaySinceLastTxn: modifiedCustomer.DaySinceLastTxn,
      NoOfTxn: modifiedCustomer.NoOfTxn,
      MeanMoneyValue: modifiedCustomer.MeanMoneyValue,
      TotalSpending: modifiedCustomer.TotalSpending,
      Segment: modSeg.Segment,
      RecencyScore: modScore.RecencyScore,
      FrequencyScore: modScore.FrequencyScore,
      MonetaryScore: modScore.MonetaryScore,
    },
    changes: {
      recencyDelta:
        (scenario.recency ?? customer.DaySinceLastTxn) -
        customer.DaySinceLastTxn,
      frequencyDelta:
        (scenario.frequency ?? customer.NoOfTxn) - customer.NoOfTxn,
      monetaryDelta:
        (scenario.monetary ?? customer.MeanMoneyValue) -
        customer.MeanMoneyValue,
    },
  }
}

/**
 * Find the minimal changes needed to move a customer to a target segment.
 * Uses a simple greedy search by trying single-axis changes first.
 */
export function whatIfTarget(
  customerID: string,
  allRFMData: RFMData[],
  targetSegment: string
): WhatIfResult | null {
  const customer = allRFMData.find((d) => d.CustomerID === customerID)
  if (!customer) return null

  // Try improving recency (reduce days)
  const steps = [
    { recency: 0 },
    { frequency: customer.NoOfTxn + 5 },
    { frequency: customer.NoOfTxn + 10 },
    { monetary: customer.MeanMoneyValue * 2 },
    { monetary: customer.MeanMoneyValue * 3 },
    { recency: 0, frequency: customer.NoOfTxn + 5 },
    { recency: 0, frequency: customer.NoOfTxn + 5, monetary: customer.MeanMoneyValue * 2 },
    { recency: 0, frequency: customer.NoOfTxn + 10, monetary: customer.MeanMoneyValue * 3 },
  ]

  for (const scenario of steps) {
    const result = whatIfAnalyze(customerID, allRFMData, scenario)
    if (result && result.modified.Segment === targetSegment) {
      return result
    }
  }

  // Return best effort (max improvement)
  return whatIfAnalyze(customerID, allRFMData, steps[steps.length - 1])
}
