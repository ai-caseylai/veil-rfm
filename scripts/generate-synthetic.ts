#!/usr/bin/env -S npx tsx
/**
 * Generate synthetic customer transaction data as CSV.
 *
 * Usage:
 *   npx tsx scripts/generate-synthetic.ts [--n 5000] [--seed 20260603] [--out synthetic_5000_txn.csv]
 *
 * Cloudflare Worker equivalent:
 *   GET /api/generate?n=5000&seed=20260603&format=csv
 */
import { writeFileSync } from "fs"
import { generateSynthetic, toCSV } from "../packages/core/src/generate"

const args = process.argv.slice(2)
let n = 5000
let seed = 20260603
let outFile = ""

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--n" && i + 1 < args.length) {
    n = parseInt(args[++i])
  } else if (args[i] === "--seed" && i + 1 < args.length) {
    seed = parseInt(args[++i])
  } else if (args[i] === "--out" && i + 1 < args.length) {
    outFile = args[++i]
  }
}

console.log(`Generating ${n} customers (seed=${seed})...`)
const result = generateSynthetic({ customers: n, seed })
console.log(
  `Done in ${result.stats.elapsedMs}ms: ${result.stats.customers} customers, ` +
    `${result.stats.orders} orders, ${result.stats.rows} rows`
)

const csv = toCSV(result.transactions)

if (outFile) {
  writeFileSync(outFile, csv, "utf-8")
  console.log(`Saved: ${outFile}`)
} else {
  // Print first 5 lines as preview
  console.log("\n--- Preview (first 5 rows) ---")
  console.log(csv.split("\n").slice(0, 6).join("\n"))
  console.log(`\n... (${result.stats.rows} rows total)`)
  console.log(`\nUse --out <file.csv> to save to disk.`)
}
