import { createContext, useContext, useState, useCallback } from "react"

export type Lang = "en" | "zh-TW" | "zh-CN"

export interface Translations {
  // Shell
  appTitle: string
  customerSegmentation: string
  overview: string
  characteristics: string
  segmentTransition: string
  customerSummary: string
  whatIfAnalysis: string
  simulateScenarios: string
  customerLifetimeValue: string
  ltvOverview: string
  qa500: string

  // Upload
  uploadTitle: string
  uploadPrompt: string
  orText: string
  loadSample: string
  loadSynthetic: string
  expectedColumns: string
  dropCSV: string

  // KPI cards
  totalCustomers: string
  totalRevenue: string
  avgOrderValue: string
  activeSegments: string

  // Overview
  customersBySegment: string
  segment: string
  numberOfCustomers: string
  percentage: string
  total: string

  // Characteristics
  avgRecency: string
  avgOrders: string
  avgSpending: string
  switch_: string
  customersByOrders: string

  // Transition
  transitionProb: string
  legendGroups: string
  loyal: string
  active: string
  losing: string
  lost: string
  legendEdges: string
  selfLoop: string
  improving: string
  degrading: string
  segmentReference: string
  predictionChart: string
  predictedCustomers: string
  period: string

  // Customer Summary
  customerID: string
  rfmScore: string
  recencyDays: string
  orders: string
  totalSpending: string
  downloadCSV: string
  searchPlaceholder: string
  showing: string
  of: string
  prev: string
  next: string

  // LTV
  avgLTVPerSegment: string
  simpleEstimate: string
  overallAvg: string
  avgLTV: string

  // What-If
  selectCustomer: string
  currentStats: string
  recencySlider: string
  frequencySlider: string
  monetarySlider: string
  simulate: string
  simulating: string
  original: string
  modified: string
  segmentChanged: string
  segmentUnchanged: string
  quickSuggest: string
  daysSinceLast: string
  ordersLabel: string
  avgSpendLabel: string
  rfmScoreLabel: string

  // Loading
  loading: string
  errorLoading: string

  // Misc
  language: string
}

const zhTW: Translations = {
  appTitle: "Veil RFM 客戶分析",
  customerSegmentation: "客戶分群",
  overview: "總覽",
  characteristics: "特徵分析",
  segmentTransition: "分群遷移",
  customerSummary: "客戶明細",
  whatIfAnalysis: "情境模擬",
  simulateScenarios: "模擬場景",
  customerLifetimeValue: "客戶終身價值",
  ltvOverview: "價值總覽",
  qa500: "問答 500",

  uploadTitle: "Veil RFM 客戶分析平台",
  uploadPrompt: "上傳 CSV 交易數據以開始分析",
  orText: "或",
  loadSample: "載入範例資料（8 位客戶，54 筆交易）",
  loadSynthetic: "載入 5,000 位客戶",
  expectedColumns: "必要欄位：MemberID, OrderID, Timestamp, NetPrice, Quantity, ProductID, ProductName, Category",
  dropCSV: "拖放 CSV 檔案至此，或點擊選取",

  totalCustomers: "總客戶數",
  totalRevenue: "總營收",
  avgOrderValue: "平均客單價",
  activeSegments: "活躍分群",

  customersBySegment: "各分群客戶數",
  segment: "分群",
  numberOfCustomers: "客戶數",
  percentage: "佔比",
  total: "合計",

  avgRecency: "平均 Recency（天）",
  avgOrders: "平均訂單數",
  avgSpending: "平均消費金額",
  switch_: "切換",
  customersByOrders: "訂單數分佈",

  transitionProb: "分群遷移機率",
  legendGroups: "圖例 — 分群",
  loyal: "忠誠 (1-3)",
  active: "活躍 (4-5)",
  losing: "流失中 (6-8)",
  lost: "已流失 (9-11)",
  legendEdges: "圖例 — 邊線",
  selfLoop: "自我循環",
  improving: "升級",
  degrading: "降級",
  segmentReference: "分群對照表",
  predictionChart: "客戶分群預測",
  predictedCustomers: "預測客戶數",
  period: "期",

  customerID: "客戶 ID",
  rfmScore: "RFM 分數",
  recencyDays: "Recency（天）",
  orders: "訂單數",
  totalSpending: "總消費金額",
  downloadCSV: "下載 CSV",
  searchPlaceholder: "搜尋客戶 ID、分群或 RFM 分數...",
  showing: "顯示",
  of: "/",
  prev: "上一頁",
  next: "下一頁",

  avgLTVPerSegment: "各分群平均客戶終身價值",
  simpleEstimate: "基於客戶總消費的簡易估算",
  overallAvg: "整體平均",
  avgLTV: "平均 LTV ($)",

  selectCustomer: "選擇客戶",
  currentStats: "目前數據",
  recencySlider: "距離上次購買天數",
  frequencySlider: "訂單數",
  monetarySlider: "平均每單消費",
  simulate: "模擬變化",
  simulating: "模擬中...",
  original: "原始",
  modified: "修改後",
  segmentChanged: "分群已變更！",
  segmentUnchanged: "分群未變",
  quickSuggest: "快速建議：模擬達到...",
  daysSinceLast: "距離上次購買天數",
  ordersLabel: "次訂單",
  avgSpendLabel: "平均消費",
  rfmScoreLabel: "RFM 分數",

  loading: "載入中...",
  errorLoading: "載入失敗",

  language: "語言",
}

const zhCN: Translations = {
  ...zhTW,
  appTitle: "Veil RFM 客户分析",
  customerSegmentation: "客户分群",
  overview: "总览",
  characteristics: "特征分析",
  segmentTransition: "分群迁移",
  customerSummary: "客户明细",
  whatIfAnalysis: "情景模拟",
  simulateScenarios: "模拟场景",
  customerLifetimeValue: "客户终身价值",
  ltvOverview: "价值总览",
  qa500: "问答 500",

  uploadTitle: "Veil RFM 客户分析平台",
  uploadPrompt: "上传 CSV 交易数据以开始分析",
  loadSample: "加载示例数据（8 位客户，54 笔交易）",
  loadSynthetic: "加载 5,000 位客户",
  expectedColumns: "必要字段：MemberID, OrderID, Timestamp, NetPrice, Quantity, ProductID, ProductName, Category",
  dropCSV: "拖放 CSV 文件至此，或点击选取",

  totalCustomers: "总客户数",
  totalRevenue: "总营收",
  avgOrderValue: "平均客单价",
  activeSegments: "活跃分群",

  customersBySegment: "各分群客户数",
  numberOfCustomers: "客户数",
  percentage: "占比",
  total: "合计",

  avgRecency: "平均 Recency（天）",
  avgOrders: "平均订单数",
  avgSpending: "平均消费金额",
  switch_: "切换",
  customersByOrders: "订单数分布",

  transitionProb: "分群迁移概率",
  legendGroups: "图例 — 分群",
  loyal: "忠诚 (1-3)",
  active: "活跃 (4-5)",
  losing: "流失中 (6-8)",
  lost: "已流失 (9-11)",
  legendEdges: "图例 — 边线",
  selfLoop: "自我循环",
  improving: "升级",
  degrading: "降级",
  segmentReference: "分群对照表",
  predictionChart: "客户分群预测",
  predictedCustomers: "预测客户数",
  period: "期",

  customerID: "客户 ID",
  rfmScore: "RFM 分数",
  recencyDays: "Recency（天）",
  orders: "订单数",
  totalSpending: "总消费金额",
  downloadCSV: "下载 CSV",
  searchPlaceholder: "搜索客户 ID、分群或 RFM 分数...",
  showing: "显示",
  of: "/",
  prev: "上一页",
  next: "下一页",

  avgLTVPerSegment: "各分群平均客户终身价值",
  simpleEstimate: "基于客户总消费的简易估算",
  overallAvg: "整体平均",
  avgLTV: "平均 LTV ($)",

  selectCustomer: "选择客户",
  currentStats: "目前数据",
  recencySlider: "距上次购买天数",
  frequencySlider: "订单数",
  monetarySlider: "平均每单消费",
  simulate: "模拟变化",
  simulating: "模拟中...",
  original: "原始",
  modified: "修改后",
  segmentChanged: "分群已变更！",
  segmentUnchanged: "分群未变",
  quickSuggest: "快速建议：模拟达到...",
  daysSinceLast: "距上次购买天数",
  ordersLabel: "次订单",
  avgSpendLabel: "平均消费",
  rfmScoreLabel: "RFM 分数",

  loading: "加载中...",
  errorLoading: "加载失败",

  language: "语言",
}

const en: Translations = {
  appTitle: "Veil RFM Analytics",
  customerSegmentation: "Customer Segmentation",
  overview: "Overview",
  characteristics: "Characteristics",
  segmentTransition: "Segment Transition",
  customerSummary: "Customer Summary",
  whatIfAnalysis: "What-If Analysis",
  simulateScenarios: "Simulate Scenarios",
  customerLifetimeValue: "Customer Lifetime Value",
  ltvOverview: "LTV Overview",
  qa500: "Q&A 500",

  uploadTitle: "Veil RFM Analytics Platform",
  uploadPrompt: "Upload a CSV file with transaction data to get started.",
  orText: "or",
  loadSample: "Load Sample Data (8 customers, 54 transactions)",
  loadSynthetic: "Load 5,000 Customers",
  expectedColumns: "Expected columns: MemberID, OrderID, Timestamp, NetPrice, Quantity, ProductID, ProductName, Category",
  dropCSV: "Drag and drop a CSV file, or click to select",

  totalCustomers: "Total Customers",
  totalRevenue: "Total Revenue",
  avgOrderValue: "Avg Order Value",
  activeSegments: "Active Segments",

  customersBySegment: "Customers by Segment",
  segment: "Segment",
  numberOfCustomers: "Customers",
  percentage: "Percentage",
  total: "Total",

  avgRecency: "Average Recency (days)",
  avgOrders: "Average Orders",
  avgSpending: "Average Spending",
  switch_: "Switch",
  customersByOrders: "Customers by Orders",

  transitionProb: "Segment Transition Probabilities",
  legendGroups: "Legend — Groups",
  loyal: "Loyal (1-3)",
  active: "Active (4-5)",
  losing: "Losing (6-8)",
  lost: "Lost (9-11)",
  legendEdges: "Legend — Edges",
  selfLoop: "Self-loop",
  improving: "Improving",
  degrading: "Degrading",
  segmentReference: "Segment Reference",
  predictionChart: "Customer Segmentation Prediction",
  predictedCustomers: "Predicted Customers",
  period: "Period",

  customerID: "Customer ID",
  rfmScore: "RFM Score",
  recencyDays: "Recency (days)",
  orders: "Orders",
  totalSpending: "Total Spending",
  downloadCSV: "Download CSV",
  searchPlaceholder: "Search by Customer ID, Segment, or RFM score...",
  showing: "Showing",
  of: "of",
  prev: "Prev",
  next: "Next",

  avgLTVPerSegment: "Average Customer Lifetime Value by Segment",
  simpleEstimate: "Simple estimate based on total spending per customer.",
  overallAvg: "Overall average",
  avgLTV: "Avg LTV ($)",

  selectCustomer: "Select Customer",
  currentStats: "Current Stats",
  recencySlider: "Days Since Last Purchase",
  frequencySlider: "Number of Orders",
  monetarySlider: "Avg Spending per Order",
  simulate: "Simulate Changes",
  simulating: "Simulating...",
  original: "Original",
  modified: "Modified",
  segmentChanged: "Segment Changed!",
  segmentUnchanged: "Segment Unchanged",
  quickSuggest: "Quick: Suggest changes to reach...",
  daysSinceLast: "Days Since Last Purchase",
  ordersLabel: "orders",
  avgSpendLabel: "Avg Spending",
  rfmScoreLabel: "RFM Score",

  loading: "Loading...",
  errorLoading: "Error loading data.",

  language: "Language",
}

const translations: Record<Lang, Translations> = { en, "zh-TW": zhTW, "zh-CN": zhCN }

// ── React context ──
export const I18nContext = createContext<{
  lang: Lang
  t: Translations
  setLang: (l: Lang) => void
}>({ lang: "en", t: en, setLang: () => {} })

export function useT() {
  return useContext(I18nContext)
}

export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "en"
  const lang = navigator.language || ""
  if (lang.startsWith("zh-TW") || lang.startsWith("zh-HK")) return "zh-TW"
  if (lang.startsWith("zh")) return "zh-CN"
  return "en"
}

export function getTranslations(lang: Lang): Translations {
  return translations[lang] || en
}
