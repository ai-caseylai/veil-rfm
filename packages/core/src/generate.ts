import type { Transaction } from "./types"
import { createRNG, rlnorm, randInt, pick, sampleWeighted } from "./rng"

// Product catalog extracted from sample_transactions.csv
const PRODUCTS: { ProductID: string; ProductName: string; Category: string; NetPrice: number }[] = [
  { ProductID: "PROD01", ProductName: "Milk", Category: "Dairy", NetPrice: 50 },
  { ProductID: "PROD02", ProductName: "Bread", Category: "Bakery", NetPrice: 45 },
  { ProductID: "PROD03", ProductName: "Steak", Category: "Meat", NetPrice: 200 },
  { ProductID: "PROD04", ProductName: "Cheese", Category: "Dairy", NetPrice: 85 },
  { ProductID: "PROD05", ProductName: "Wine", Category: "Beverage", NetPrice: 180 },
  { ProductID: "PROD06", ProductName: "Eggs", Category: "Dairy", NetPrice: 35 },
  { ProductID: "PROD07", ProductName: "Butter", Category: "Dairy", NetPrice: 40 },
  { ProductID: "PROD08", ProductName: "Yogurt", Category: "Dairy", NetPrice: 30 },
  { ProductID: "PROD09", ProductName: "Chocolate", Category: "Snacks", NetPrice: 50 },
  { ProductID: "PROD10", ProductName: "Coffee", Category: "Beverage", NetPrice: 80 },
  { ProductID: "PROD11", ProductName: "Salmon", Category: "Seafood", NetPrice: 150 },
  { ProductID: "PROD12", ProductName: "Champagne", Category: "Beverage", NetPrice: 500 },
  { ProductID: "PROD13", ProductName: "Lobster", Category: "Seafood", NetPrice: 300 },
]

const GENDERS = ["M", "F"] as const
const GENDER_WEIGHTS = [0.45, 0.55]

export interface GenerateOptions {
  /** Number of customers to generate (default 5000) */
  customers?: number
  /** Random seed for reproducibility (default 20260603) */
  seed?: number
  /** Reference date for recency calculations (default: now) */
  referenceDate?: Date
  /** Min days between orders (default 3) */
  freqMinDays?: number
  /** Max days between orders (default 28) */
  freqMaxDays?: number
  /** Min order value (default 50) */
  valueMin?: number
  /** Max order value (default 800) */
  valueMax?: number
  /** Min items per order (default 1) */
  itemsMin?: number
  /** Max items per order (default 6) */
  itemsMax?: number
  /** Log-normal meanlog for recency (default 4.8) */
  recencyMeanlog?: number
  /** Log-normal sdlog for recency (default 0.8) */
  recencySdlog?: number
}

export interface GenerateResult {
  transactions: Transaction[]
  stats: {
    customers: number
    orders: number
    rows: number
    elapsedMs: number
  }
}

/** Format date as ISO-style timestamp string */
function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day} 00:00:00`
}

/**
 * Generate synthetic customer transaction data.
 * Same statistical distributions as the R pipeline.
 */
export function generateSynthetic(options: GenerateOptions = {}): GenerateResult {
  const {
    customers = 5000,
    seed = 20260603,
    referenceDate = new Date(),
    freqMinDays = 3,
    freqMaxDays = 28,
    valueMin = 50,
    valueMax = 800,
    itemsMin = 1,
    itemsMax = 6,
    recencyMeanlog = 4.8,
    recencySdlog = 0.8,
  } = options

  const rng = createRNG(seed)
  const t0 = performance.now()
  const refDate = new Date(referenceDate.getTime())

  const transactions: Transaction[] = []
  let orderSeq = 0

  // Pre-compute product weights from base prices
  const productWeights = PRODUCTS.map((p) => p.NetPrice)

  for (let cid = 1000; cid < 1000 + customers; cid++) {
    const memberId = `S${String(cid).padStart(6, "0")}`
    const interval = freqMinDays + rng() * (freqMaxDays - freqMinDays)
    const recency = Math.min(500, Math.max(10, Math.round(rlnorm(recencyMeanlog, recencySdlog, rng))))
    const lifespan = Math.max(14, Math.round(30 + rng() * 370))
    const nOrders = Math.max(1, Math.round(lifespan / interval))
    const lastDay = new Date(refDate.getTime() - recency * 86400000)
    const firstDay = new Date(lastDay.getTime() - lifespan * 86400000)
    const gender = sampleWeighted(GENDERS, GENDER_WEIGHTS, rng)

    for (let o = 0; o < nOrders; o++) {
      const offset = Math.round(o * interval + (rng() - 0.5) * 4)
      const odate = new Date(firstDay.getTime() + offset * 86400000)
      if (odate > refDate) continue

      orderSeq++
      const orderId = `S${String(orderSeq).padStart(10, "0")}`
      const nItems = randInt(itemsMin, itemsMax, rng)
      const targetTotal = valueMin + rng() * (valueMax - valueMin)

      // Pick items & compute raw total
      const picks: { product: (typeof PRODUCTS)[number]; qty: number; price: number }[] = []
      let rawTotal = 0
      for (let i = 0; i < nItems; i++) {
        const product = pick(PRODUCTS, rng)
        const qty = randInt(1, 3, rng)
        const price = Math.round(product.NetPrice * (0.8 + rng() * 0.5) * 100) / 100
        picks.push({ product, qty, price })
        rawTotal += price * qty
      }

      const scale = targetTotal / rawTotal
      for (const item of picks) {
        const finalPrice = Math.round(item.price * scale * 100) / 100
        transactions.push({
          MemberID: memberId,
          OrderID: orderId,
          Timestamp: fmtDate(odate),
          ProductID: item.product.ProductID,
          ProductName: item.product.ProductName,
          Category: item.product.Category,
          NetPrice: finalPrice,
          Quantity: item.qty,
          Gender: gender,
        })
      }
    }
  }

  const elapsedMs = performance.now() - t0
  const customerSet = new Set(transactions.map((t) => t.MemberID))
  const orderSet = new Set(transactions.map((t) => t.OrderID))

  return {
    transactions,
    stats: {
      customers: customerSet.size,
      orders: orderSet.size,
      rows: transactions.length,
      elapsedMs: Math.round(elapsedMs),
    },
  }
}

/** Serialize transactions to CSV string */
export function toCSV(transactions: Transaction[]): string {
  const header = "MemberID,OrderID,Timestamp,NetPrice,Quantity,ProductID,ProductName,Category,Gender"
  const rows = transactions.map((t) =>
    [t.MemberID, t.OrderID, t.Timestamp, t.NetPrice, t.Quantity, t.ProductID, t.ProductName, t.Category, t.Gender ?? ""].join(",")
  )
  return [header, ...rows].join("\n")
}
