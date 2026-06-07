import { useState, useCallback } from "react"
import type { Transaction } from "@veil-rfm/core"
import { parseCSV } from "../lib/parse"
import { useT } from "../lib/i18n"

interface Props {
  onDataLoaded: (transactions: Transaction[]) => void
}

export default function FileUpload({ onDataLoaded }: Props) {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file) return
      await loadFile(file)
    },
    [onDataLoaded]
  )

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await loadFile(file)
    },
    [onDataLoaded]
  )

  async function loadFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const txns = await parseCSV(file)
      if (txns.length === 0) {
        setError("No valid transactions found in file")
      } else {
        onDataLoaded(txns)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors"
    >
      {loading ? (
        <p className="text-gray-500">{t.loading}</p>
      ) : (
        <>
          <p className="text-gray-500 mb-3 text-sm">{t.dropCSV}</p>
          <input type="file" accept=".csv" onChange={handleFile} className="block mx-auto text-sm" />
          {error && <p className="text-red-500 mt-2 text-xs">{error}</p>}
        </>
      )}
    </div>
  )
}
