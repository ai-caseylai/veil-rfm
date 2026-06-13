import { SEGMENT_LABELS } from "@veil-rfm/core"
import type { SegmentName } from "@veil-rfm/core"
import type { Lang } from "./i18n"

export function segLabel(segment: string, lang: Lang): string {
  return SEGMENT_LABELS[segment as SegmentName]?.[lang] ?? segment
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
