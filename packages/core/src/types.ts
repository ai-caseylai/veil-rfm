// ── Transaction data ──
export interface Transaction {
  MemberID: string
  OrderID: string
  Timestamp: string // ISO 8601
  NetPrice?: number
  TotalPrice?: number
  Quantity?: number
  ProductID?: string
  ProductName?: string
  Category?: string
  Gender?: string
}

// ── RFM per-customer statistics ──
export interface RFMData {
  CustomerID: string
  DaySinceLastTxn: number
  NoOfTxn: number
  MeanMoneyValue: number
  TotalSpending: number
  Gender?: string
}

// ── RFM scores (1–5) ──
export interface RFMScore {
  CustomerID: string
  RecencyScore: number
  FrequencyScore: number
  MonetaryScore: number
  FinalScore: number
  RecencyWeightedScore: number
  FrequencyWeightedScore: number
  MonetaryWeightedScore: number
  FinalWeightedScore: number
}

// ── RFM segment ──
export interface RFMSegment {
  CustomerID: string
  Segment: string
}

// ── Combined RFM results ──
export interface RFMResult {
  CustomerID: string
  Segment: string
  DaySinceLastTxn: number
  NoOfTxn: number
  TotalSpending: number
  RecencyScore: number
  FrequencyScore: number
  MonetaryScore: number
  Gender?: string
}

// ── Markov Chain ──
export interface MCState {
  ID: string
  Time: number
  State: string
}

export type TransitionMatrix = number[][] // [from][to]

// ── Segment movement prediction ──
export interface SegmentMovement {
  Time: number
  Segment: string
  Predicted: number
}

// ── Customer summary (LTV) ──
export interface LTVSummary {
  CustomerID: string
  lifetimeValue: number
  pAlive: number
}

// ── API request/response ──
export interface RFMRequest {
  transactions: Transaction[]
  maxScore?: number
  recencyWeight?: number
  frequencyWeight?: number
  monetaryWeight?: number
  minTxn?: number
}

export interface RFMResponse {
  rfmData: RFMData[]
  rfmScore: RFMScore[]
  rfmSegment: RFMSegment[]
  results: RFMResult[]
}

export interface TransitionRequest {
  transactions: Transaction[]
  rfmPeriod?: [number, string] // e.g. [1, "year"]
  transitionPeriod?: [number, string] // e.g. [1, "month"]
}

export interface TransitionResponse {
  mcSeq: MCState[]
  mcCounts: TransitionMatrix[]
  transProb: TransitionMatrix
}

export interface PredictRequest {
  transProb: number[][]
  initProp: number[]
  nCustomer: number
  nperiod?: number
}

export interface PredictResponse {
  predictedSegmentMovement: SegmentMovement[]
}

// ── 11 RFM segments (matches R source) ──
export const RFM_SEGMENT = [
  "Best Customers",
  "Loyal Customers",
  "Potential Loyalist",
  "Low-spending Active Loyal Customers",
  "High-spending New Customers",
  "Almost Lost Customers",
  "Churned Best Customers",
  "Customers Needing Attention",
  "About to Sleep Customers",
  "Hibernating Customers",
  "Lost Cheap Customers",
] as const

export type SegmentName = (typeof RFM_SEGMENT)[number]
