import { useState } from "react"
import { useNavigate } from "react-router-dom"
import FileUpload from "../components/FileUpload"
import { useT } from "../lib/i18n"
import type { Transaction } from "@veil-rfm/core"
import type { AppData } from "../App"

interface Props {
  data: AppData
  onImport: (txns: Transaction[]) => void
}

export default function Import({ data, onImport }: Props) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [lastImport, setLastImport] = useState<{ count: number } | null>(null)

  const results = (data.rfmData?.results as Array<Record<string, unknown>>) ?? []
  const segments = (data.rfmData?.segments as Array<Record<string, unknown>>) ?? []

  const importedMsg =
    lang === "zh-TW" ? "成功導入" : lang === "zh-CN" ? "成功导入" : "Imported"
  const txnsLabel =
    lang === "zh-TW" ? "筆交易" : lang === "zh-CN" ? "笔交易" : "transactions"
  const datasetLabel =
    lang === "zh-TW" ? "目前資料集" : lang === "zh-CN" ? "目前数据集" : "Current Dataset"

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <div className="card-header">{t.uploadTitle}</div>
        <div className="card-body">
          <p className="text-sm text-gray-500 mb-4">{t.uploadPrompt}</p>
          <FileUpload
            onDataLoaded={(txns) => {
              onImport(txns)
              setLastImport({ count: txns.length })
              navigate("/rfm-overview")
            }}
          />
          {lastImport && (
            <p className="mt-3 text-sm text-green-600">
              ✓ {importedMsg} {lastImport.count} {txnsLabel}
            </p>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">{datasetLabel}</div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[var(--primary)]">{data.transactions.length}</div>
                <div className="text-xs text-gray-500 mt-1">{txnsLabel}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--primary)]">{results.length}</div>
                <div className="text-xs text-gray-500 mt-1">{t.totalCustomers}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--primary)]">{segments.filter((s: Record<string, unknown>) => (s["Number of Customers"] as number) > 0).length}/11</div>
                <div className="text-xs text-gray-500 mt-1">{t.activeSegments}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">{t.expectedColumns}</p>
    </div>
  )
}
