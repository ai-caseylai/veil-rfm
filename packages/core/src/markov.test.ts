import { describe, it, expect } from "vitest"
import {
  txn2rfmSegmentList,
  rfmSegment2mcSeq,
  mcSeq2Counts,
  mcCounts2Prob,
  predictSegmentMovement,
  mcSeq2Prop,
} from "./markov"
import type { Transaction } from "./types"
import { RFM_SEGMENT } from "./types"

// Generate synthetic transactions over 2 years with clear patterns
function makeTxns(): Transaction[] {
  const txns: Transaction[] = []
  let orderId = 1

  // C1: monthly high spender (Best Customer) for 2 years
  for (let m = 0; m < 24; m++) {
    const date = new Date(2023, m, 15)
    txns.push({
      MemberID: "C1",
      OrderID: `O${orderId++}`,
      Timestamp: date.toISOString(),
      NetPrice: 200 + m * 5,
    })
  }

  // C2: one purchase then nothing (Lost)
  txns.push({
    MemberID: "C2",
    OrderID: `O${orderId++}`,
    Timestamp: new Date(2023, 0, 10).toISOString(),
    NetPrice: 50,
  })

  // C3: occasional buyer, 4 purchases in year 1, 2 in year 2
  for (const m of [0, 3, 7, 11, 14, 20]) {
    txns.push({
      MemberID: "C3",
      OrderID: `O${orderId++}`,
      Timestamp: new Date(2023, m, 1).toISOString(),
      NetPrice: 80,
    })
  }

  return txns
}

describe("txn2rfmSegmentList", () => {
  it("produces a list of segment arrays for each time window", () => {
    const txns = makeTxns()
    const segmentList = txn2rfmSegmentList(txns, [1, "year"], [3, "month"])

    expect(segmentList.length).toBeGreaterThan(0)
    for (const segs of segmentList) {
      expect(Array.isArray(segs)).toBe(true)
      for (const s of segs) {
        expect(typeof s.CustomerID).toBe("string")
        expect(typeof s.Segment).toBe("string")
      }
    }
  })
})

describe("rfmSegment2mcSeq", () => {
  it("converts segment list to Markov chain sequence", () => {
    const txns = makeTxns()
    const segmentList = txn2rfmSegmentList(txns, [1, "year"], [3, "month"])
    const mcSeq = rfmSegment2mcSeq(segmentList)

    expect(mcSeq.length).toBeGreaterThan(0)
    expect(mcSeq[0]).toHaveProperty("ID")
    expect(mcSeq[0]).toHaveProperty("Time")
    expect(mcSeq[0]).toHaveProperty("State")

    // C1 should appear in all periods
    const c1Entries = mcSeq.filter((s) => s.ID === "C1")
    expect(c1Entries.length).toBeGreaterThan(0)
  })
})

describe("mcSeq2Counts + mcCounts2Prob", () => {
  it("computes transition probability matrix", () => {
    const txns = makeTxns()
    const segmentList = txn2rfmSegmentList(txns, [1, "year"], [3, "month"])
    const mcSeq = rfmSegment2mcSeq(segmentList)
    const counts = mcSeq2Counts(mcSeq)
    const probs = mcCounts2Prob(counts)

    expect(probs.length).toBe(RFM_SEGMENT.length)
    // Each row should sum to 1 (or 0 if no transitions)
    for (const row of probs) {
      const sum = row.reduce((a, b) => a + b, 0)
      expect(sum === 0 || Math.abs(sum - 1) < 0.001).toBe(true)
    }
  })
})

describe("predictSegmentMovement", () => {
  it("predicts segment distribution forward", () => {
    const n = RFM_SEGMENT.length
    // Identity-ish matrix: everyone stays in their segment
    const transProb = RFM_SEGMENT.map((_, i) =>
      RFM_SEGMENT.map((_, j) => (i === j ? 0.9 : 0.1 / (n - 1)))
    )
    const initProp = RFM_SEGMENT.map(() => 1 / n)
    const nCustomer = 1000

    const result = predictSegmentMovement(initProp, transProb, nCustomer, 3)

    expect(result.length).toBe(n * 4) // 4 periods (0,1,2,3) * n segments
    expect(result[0].Time).toBe(0)
    expect(result[result.length - 1].Time).toBe(3)
  })
})

describe("mcSeq2Prop", () => {
  it("returns proportions that sum to 1", () => {
    const txns = makeTxns()
    const segmentList = txn2rfmSegmentList(txns, [1, "year"], [3, "month"])
    const mcSeq = rfmSegment2mcSeq(segmentList)
    const prop = mcSeq2Prop(mcSeq)

    const sum = prop.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1) < 0.001).toBe(true)
  })
})
