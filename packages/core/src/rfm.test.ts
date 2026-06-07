import { describe, it, expect } from "vitest"
import { getRFMData, rfmCompute, rfmSegmentation, computeRFM } from "./rfm"
import type { Transaction } from "./types"

const sampleTxns: Transaction[] = [
  { MemberID: "C1", OrderID: "O1", Timestamp: "2024-01-15T10:00:00Z", NetPrice: 100 },
  { MemberID: "C1", OrderID: "O2", Timestamp: "2024-02-20T10:00:00Z", NetPrice: 200 },
  { MemberID: "C1", OrderID: "O3", Timestamp: "2024-06-01T10:00:00Z", NetPrice: 150 },
  { MemberID: "C2", OrderID: "O4", Timestamp: "2024-05-01T10:00:00Z", NetPrice: 50 },
  { MemberID: "C3", OrderID: "O5", Timestamp: "2024-01-01T10:00:00Z", NetPrice: 10 },
  { MemberID: "C3", OrderID: "O6", Timestamp: "2024-01-02T10:00:00Z", NetPrice: 20 },
  { MemberID: "C3", OrderID: "O7", Timestamp: "2024-01-03T10:00:00Z", NetPrice: 30 },
  { MemberID: "C3", OrderID: "O8", Timestamp: "2024-06-30T10:00:00Z", NetPrice: 500 },
]

describe("getRFMData", () => {
  it("aggregates transactions into per-customer RFM stats", () => {
    const endDate = new Date("2024-07-01T00:00:00Z")
    const data = getRFMData(sampleTxns, endDate)

    expect(data).toHaveLength(3)

    const c1 = data.find((d) => d.CustomerID === "C1")!
    expect(c1.NoOfTxn).toBe(3)
    expect(c1.MeanMoneyValue).toBeCloseTo(150)
    expect(c1.TotalSpending).toBe(450)

    const c2 = data.find((d) => d.CustomerID === "C2")!
    expect(c2.NoOfTxn).toBe(1)
    expect(c2.TotalSpending).toBe(50)

    const c3 = data.find((d) => d.CustomerID === "C3")!
    expect(c3.NoOfTxn).toBe(4)
    expect(c3.TotalSpending).toBe(560)
  })

  it("deduplicates repeated OrderIDs", () => {
    const dupTxns: Transaction[] = [
      { MemberID: "C1", OrderID: "O1", Timestamp: "2024-01-01T00:00:00Z", NetPrice: 100 },
      { MemberID: "C1", OrderID: "O1", Timestamp: "2024-01-01T00:00:00Z", NetPrice: 100 },
    ]
    const data = getRFMData(dupTxns)
    expect(data).toHaveLength(1)
    expect(data[0].NoOfTxn).toBe(1)
  })
})

describe("rfmCompute", () => {
  it("assigns scores 1-5 based on percentiles", () => {
    const rfmData = getRFMData(sampleTxns, new Date("2024-07-01T00:00:00Z"))
    const scores = rfmCompute(rfmData)

    expect(scores).toHaveLength(3)
    for (const s of scores) {
      expect(s.RecencyScore).toBeGreaterThanOrEqual(1)
      expect(s.RecencyScore).toBeLessThanOrEqual(5)
      expect(s.FrequencyScore).toBeGreaterThanOrEqual(1)
      expect(s.FrequencyScore).toBeLessThanOrEqual(5)
      expect(s.MonetaryScore).toBeGreaterThanOrEqual(1)
      expect(s.MonetaryScore).toBeLessThanOrEqual(5)
    }

    // C3 has most transactions (4), should get highest F score
    const c3 = scores.find((s) => s.CustomerID === "C3")!
    const c2 = scores.find((s) => s.CustomerID === "C2")!
    expect(c3.FrequencyScore).toBeGreaterThanOrEqual(c2.FrequencyScore)
  })

  it("handles empty input", () => {
    const scores = rfmCompute([])
    expect(scores).toEqual([])
  })
})

describe("rfmSegmentation", () => {
  it("classifies into the 11-segment scheme", () => {
    const rfmData = getRFMData(sampleTxns, new Date("2024-07-01T00:00:00Z"))
    const scores = rfmCompute(rfmData)
    const segments = rfmSegmentation(scores)

    expect(segments).toHaveLength(3)
    for (const seg of segments) {
      expect(typeof seg.Segment).toBe("string")
    }
  })

  it("puts all-5 scores into Best Customers", () => {
    const perfectScores = [
      {
        CustomerID: "BEST",
        RecencyScore: 5,
        FrequencyScore: 5,
        MonetaryScore: 5,
        FinalScore: 60,
        RecencyWeightedScore: 20,
        FrequencyWeightedScore: 20,
        MonetaryWeightedScore: 20,
        FinalWeightedScore: 5,
      },
    ]
    const segments = rfmSegmentation(perfectScores)
    expect(segments[0].Segment).toBe("Best Customers")
  })

  it("puts all-1 scores into Lost Cheap Customers", () => {
    const worstScores = [
      {
        CustomerID: "LOST",
        RecencyScore: 1,
        FrequencyScore: 1,
        MonetaryScore: 1,
        FinalScore: 12,
        RecencyWeightedScore: 4,
        FrequencyWeightedScore: 4,
        MonetaryWeightedScore: 4,
        FinalWeightedScore: 1,
      },
    ]
    const segments = rfmSegmentation(worstScores)
    expect(segments[0].Segment).toBe("Lost Cheap Customers")
  })
})

describe("computeRFM", () => {
  it("returns full RFM result structure", () => {
    const result = computeRFM({ transactions: sampleTxns })

    expect(result.rfmData).toBeDefined()
    expect(result.rfmScore).toBeDefined()
    expect(result.rfmSegment).toBeDefined()
    expect(result.results).toBeDefined()
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0].Segment).toBeDefined()
  })
})
