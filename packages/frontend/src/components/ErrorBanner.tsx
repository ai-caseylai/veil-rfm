import type { Lang } from "../lib/i18n"

interface Props {
  message: string
  onRetry?: () => void
  lang: Lang
}

export default function ErrorBanner({ message, onRetry, lang }: Props) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex flex-col items-center gap-3 p-6 bg-red-50 border border-red-200 rounded-xl">
        <span className="text-3xl">⚠️</span>
        <p className="text-red-700 text-sm font-medium">
          {lang === "zh-TW" ? "載入失敗" : lang === "zh-CN" ? "加载失败" : "Failed to load data"}
        </p>
        <p className="text-red-500 text-xs max-w-md">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary text-xs">
            {lang === "zh-TW" ? "重試" : lang === "zh-CN" ? "重试" : "Retry"}
          </button>
        )}
      </div>
    </div>
  )
}
