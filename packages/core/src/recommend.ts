/**
 * Recommendation System: Item-Based Collaborative Filtering + Association Rules
 *
 * Ported from the original R MBA (Market Basket Analysis) module.
 * Uses co-purchase patterns to recommend items and discover association rules.
 */

import type { Transaction } from "./types"

// ── Types ──

export interface RecommendedItem {
  productID: string
  productName: string
  score: number        // recommendation score (higher = stronger recommendation)
  support: number      // fraction of customers who bought both items
  confidence: number   // conditional probability
  lift: number         // lift over random chance
}

export interface AssociationRule {
  antecedent: string[]   // "if bought these"
  consequent: string[]   // "likely to buy these"
  support: number
  confidence: number
  lift: number
}

export interface RecommendResult {
  customerID: string
  purchasedItems: string[]
  recommendations: RecommendedItem[]
}

// ── Item-based Collaborative Filtering ──

/**
 * Build item co-occurrence matrix from transactions.
 * Matrix[i][j] = number of customers who bought both item i and item j.
 */
function buildCoOccurrence(transactions: Transaction[]): {
  matrix: Map<string, Map<string, number>>
  itemCounts: Map<string, number>
  itemNames: Map<string, string>
  customerItems: Map<string, Set<string>>
  totalCustomers: number
} {
  // Map customer → set of unique products purchased
  const customerItems = new Map<string, Set<string>>()
  const itemNames = new Map<string, string>()
  const itemCounts = new Map<string, number>()

  for (const t of transactions) {
    if (!t.ProductID) continue
    const cust = t.MemberID
    const prod = t.ProductID
    const name = t.ProductName ?? t.ProductID

    itemNames.set(prod, name)
    itemCounts.set(prod, (itemCounts.get(prod) ?? 0) + 1)

    const items = customerItems.get(cust) ?? new Set<string>()
    items.add(prod)
    customerItems.set(cust, items)
  }

  const totalCustomers = customerItems.size

  // Build co-occurrence matrix
  const matrix = new Map<string, Map<string, number>>()

  for (const [, items] of customerItems) {
    const itemList = [...items]
    for (let i = 0; i < itemList.length; i++) {
      for (let j = i + 1; j < itemList.length; j++) {
        const [a, b] = [itemList[i], itemList[j]]
        for (const [x, y] of [[a, b], [b, a]] as const) {
          const row = matrix.get(x) ?? new Map<string, number>()
          row.set(y, (row.get(y) ?? 0) + 1)
          matrix.set(x, row)
        }
      }
    }
  }

  return { matrix, itemCounts, itemNames, customerItems, totalCustomers }
}

/**
 * Recommend items for a customer using item-based CF.
 * Score = Σ_{purchased items i} (co-purchase count with candidate j / total buyers of i)
 */
export function recommendForCustomer(
  customerID: string,
  transactions: Transaction[],
  topN = 5
): RecommendResult | null {
  const { matrix, itemCounts, itemNames, customerItems, totalCustomers } = buildCoOccurrence(transactions)

  const purchased = customerItems.get(customerID)
  if (!purchased || purchased.size === 0) return null

  // Score candidate items
  const scores = new Map<string, number>()

  for (const boughtItem of purchased) {
    const coCounts = matrix.get(boughtItem)
    if (!coCounts) continue

    const boughtCount = itemCounts.get(boughtItem) ?? 1

    for (const [candidate, coCount] of coCounts) {
      if (purchased.has(candidate)) continue // skip already purchased

      // Item-based CF score
      const score = coCount / boughtCount
      scores.set(candidate, (scores.get(candidate) ?? 0) + score)
    }
  }

  // Sort and get top N
  const recommendations: RecommendedItem[] = [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([prod, score]) => {
      const coRow = matrix.get(prod)
      let coTotal = 0
      for (const bought of purchased) {
        coTotal += coRow?.get(bought) ?? 0
      }
      const support = coTotal / totalCustomers
      const confidence = coTotal / purchased.size
      const itemSupport = (itemCounts.get(prod) ?? 1) / totalCustomers
      const lift = itemSupport > 0 ? confidence / itemSupport : 0

      return {
        productID: prod,
        productName: itemNames.get(prod) ?? prod,
        score,
        support,
        confidence,
        lift,
      }
    })

  return {
    customerID,
    purchasedItems: [...purchased].map((p) => itemNames.get(p) ?? p),
    recommendations,
  }
}

// ── Association Rule Mining (Market Basket Analysis) ──

/**
 * Mine association rules using Apriori-like approach.
 */
export function mineAssociationRules(
  transactions: Transaction[],
  minSupport = 0.05,
  minConfidence = 0.1,
  maxRules = 50
): AssociationRule[] {
  const { customerItems, itemNames, totalCustomers } = buildCoOccurrence(transactions)

  // Count item occurrences
  const itemCounts = new Map<string, number>()
  for (const [, items] of customerItems) {
    for (const item of items) {
      itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1)
    }
  }

  // Count pair co-occurrences
  const pairCounts = new Map<string, number>()
  for (const [, items] of customerItems) {
    const itemList = [...items]
    for (let i = 0; i < itemList.length; i++) {
      for (let j = i + 1; j < itemList.length; j++) {
        const key = [itemList[i], itemList[j]].sort().join("||")
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  // Generate rules from frequent pairs
  const rules: AssociationRule[] = []

  for (const [key, pairCount] of pairCounts) {
    const [a, b] = key.split("||")
    const support = pairCount / totalCustomers
    if (support < minSupport) continue

    // Rule: A → B
    const aCount = itemCounts.get(a) ?? 1
    const confAB = pairCount / aCount
    const bSupport = (itemCounts.get(b) ?? 1) / totalCustomers
    const liftAB = bSupport > 0 ? confAB / bSupport : 0

    if (confAB >= minConfidence && liftAB > 1) {
      rules.push({
        antecedent: [itemNames.get(a) ?? a],
        consequent: [itemNames.get(b) ?? b],
        support,
        confidence: confAB,
        lift: liftAB,
      })
    }

    // Rule: B → A
    const bCount = itemCounts.get(b) ?? 1
    const confBA = pairCount / bCount
    const aSupport = (itemCounts.get(a) ?? 1) / totalCustomers
    const liftBA = aSupport > 0 ? confBA / aSupport : 0

    if (confBA >= minConfidence && liftBA > 1) {
      rules.push({
        antecedent: [itemNames.get(b) ?? b],
        consequent: [itemNames.get(a) ?? a],
        support,
        confidence: confBA,
        lift: liftBA,
      })
    }
  }

  // Sort by lift (most interesting rules first), limit
  rules.sort((a, b) => b.lift - a.lift)
  return rules.slice(0, maxRules)
}

/**
 * Get recommendations for all customers.
 */
export function recommendAll(
  transactions: Transaction[],
  topN = 5
): RecommendResult[] {
  const { customerItems } = buildCoOccurrence(transactions)
  const results: RecommendResult[] = []

  for (const [custID] of customerItems) {
    const result = recommendForCustomer(custID, transactions, topN)
    if (result) results.push(result)
  }

  return results
}
