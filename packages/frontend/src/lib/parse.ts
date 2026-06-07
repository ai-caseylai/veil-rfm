import Papa from "papaparse"
import type { Transaction } from "@veil-rfm/core"

export function parseCSV(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        const txns: Transaction[] = (results.data as Record<string, unknown>[])
          .filter((row) => row.MemberID && row.OrderID && row.Timestamp)
          .map((row) => ({
            MemberID: String(row.MemberID),
            OrderID: String(row.OrderID),
            Timestamp: String(row.Timestamp),
            NetPrice:
              row.NetPrice != null ? Number(row.NetPrice) : undefined,
            TotalPrice:
              row.TotalPrice != null
                ? Number(row.TotalPrice)
                : undefined,
            Quantity:
              row.Quantity != null ? Number(row.Quantity) : undefined,
            ProductID:
              row.ProductID != null ? String(row.ProductID) : undefined,
            ProductName:
              row.ProductName != null
                ? String(row.ProductName)
                : undefined,
            Category:
              row.Category != null ? String(row.Category) : undefined,
            Gender:
              row.Gender != null ? String(row.Gender) : undefined,
          }))
        resolve(txns)
      },
      error(err: Error) {
        reject(err)
      },
    })
  })
}
