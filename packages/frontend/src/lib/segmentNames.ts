import { SEGMENT_LABELS } from "@veil-rfm/core"
import type { SegmentName } from "@veil-rfm/core"
import type { Lang } from "./i18n"

import { RFM_SEGMENT } from "@veil-rfm/core"

/** Canonical segment order index for sorting */
const SEGMENT_ORDER = new Map(RFM_SEGMENT.map((s, i) => [s, i]))

/** Sort segment data by canonical RFM order */
export function sortSegments<T extends { Segment: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (SEGMENT_ORDER.get(a.Segment as SegmentName) ?? 99) - (SEGMENT_ORDER.get(b.Segment as SegmentName) ?? 99))
}


export function segLabel(segment: string, lang: Lang): string {
  return SEGMENT_LABELS[segment as SegmentName]?.[lang] ?? segment
}

/** Short segment labels for pie charts (English names are too long) */
const PIE_SEGMENT_LABELS: Record<string, { en: string; "zh-TW": string; "zh-CN": string }> = {
  "Best Customers": { en: "Best", "zh-TW": "最佳客戶", "zh-CN": "最佳客户" },
  "Loyal Customers": { en: "Loyal", "zh-TW": "忠誠客戶", "zh-CN": "忠诚客户" },
  "Potential Loyalist": { en: "Pot. Loyalist", "zh-TW": "潛在忠誠客戶", "zh-CN": "潜在忠诚客户" },
  "Low-spending Active Loyal Customers": { en: "Low-spend Loyal", "zh-TW": "低消費活躍忠誠", "zh-CN": "低消费活跃忠诚" },
  "High-spending New Customers": { en: "High-spend New", "zh-TW": "高消費新客戶", "zh-CN": "高消费新客户" },
  "Almost Lost Customers": { en: "Almost Lost", "zh-TW": "即將流失客戶", "zh-CN": "即将流失客户" },
  "Churned Best Customers": { en: "Churned Best", "zh-TW": "已流失最佳客戶", "zh-CN": "已流失最佳客户" },
  "Customers Needing Attention": { en: "Needs Attn.", "zh-TW": "需關注客戶", "zh-CN": "需关注客户" },
  "About to Sleep Customers": { en: "About to Sleep", "zh-TW": "即將沉睡客戶", "zh-CN": "即将沉睡客户" },
  "Hibernating Customers": { en: "Hibernating", "zh-TW": "休眠客戶", "zh-CN": "休眠客户" },
  "Lost Cheap Customers": { en: "Lost Cheap", "zh-TW": "已流失低消費", "zh-CN": "已流失低消费" },
}

export function pieSegLabel(segment: string, lang: Lang): string {
  return PIE_SEGMENT_LABELS[segment]?.[lang] ?? segment
}

const PRODUCT_NAMES: Record<string, { en: string; "zh-TW": string; "zh-CN": string }> = {
  Milk: { en: "Milk", "zh-TW": "牛奶", "zh-CN": "牛奶" },
  Bread: { en: "Bread", "zh-TW": "麵包", "zh-CN": "面包" },
  Steak: { en: "Steak", "zh-TW": "牛排", "zh-CN": "牛排" },
  Cheese: { en: "Cheese", "zh-TW": "起司", "zh-CN": "奶酪" },
  Wine: { en: "Wine", "zh-TW": "紅酒", "zh-CN": "红酒" },
  Eggs: { en: "Eggs", "zh-TW": "雞蛋", "zh-CN": "鸡蛋" },
  Butter: { en: "Butter", "zh-TW": "奶油", "zh-CN": "黄油" },
  Yogurt: { en: "Yogurt", "zh-TW": "優格", "zh-CN": "酸奶" },
  Chocolate: { en: "Chocolate", "zh-TW": "巧克力", "zh-CN": "巧克力" },
  Coffee: { en: "Coffee", "zh-TW": "咖啡", "zh-CN": "咖啡" },
  Salmon: { en: "Salmon", "zh-TW": "鮭魚", "zh-CN": "三文鱼" },
  Champagne: { en: "Champagne", "zh-TW": "香檳", "zh-CN": "香槟" },
  Lobster: { en: "Lobster", "zh-TW": "龍蝦", "zh-CN": "龙虾" },
}

export function prodLabel(name: string, lang: Lang): string {
  return PRODUCT_NAMES[name]?.[lang] ?? name
}
