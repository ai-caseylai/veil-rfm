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

/** Bilingual segment name map for UI display */
export const SEGMENT_LABELS: Record<SegmentName, { en: string; "zh-TW": string; "zh-CN": string }> = {
  "Best Customers": { en: "Best Customers", "zh-TW": "最佳客戶", "zh-CN": "最佳客户" },
  "Loyal Customers": { en: "Loyal Customers", "zh-TW": "忠誠客戶", "zh-CN": "忠诚客户" },
  "Potential Loyalist": { en: "Potential Loyalist", "zh-TW": "潛在忠誠客戶", "zh-CN": "潜在忠诚客户" },
  "Low-spending Active Loyal Customers": { en: "Low-spending Active Loyal Customers", "zh-TW": "低消費活躍忠誠客戶", "zh-CN": "低消费活跃忠诚客户" },
  "High-spending New Customers": { en: "High-spending New Customers", "zh-TW": "高消費新客戶", "zh-CN": "高消费新客户" },
  "Almost Lost Customers": { en: "Almost Lost Customers", "zh-TW": "即將流失客戶", "zh-CN": "即将流失客户" },
  "Churned Best Customers": { en: "Churned Best Customers", "zh-TW": "已流失最佳客戶", "zh-CN": "已流失最佳客户" },
  "Customers Needing Attention": { en: "Customers Needing Attention", "zh-TW": "需關注客戶", "zh-CN": "需关注客户" },
  "About to Sleep Customers": { en: "About to Sleep Customers", "zh-TW": "即將沉睡客戶", "zh-CN": "即将沉睡客户" },
  "Hibernating Customers": { en: "Hibernating Customers", "zh-TW": "休眠客戶", "zh-CN": "休眠客户" },
  "Lost Cheap Customers": { en: "Lost Cheap Customers", "zh-TW": "已流失低消費客戶", "zh-CN": "已流失低消费客户" },
}
