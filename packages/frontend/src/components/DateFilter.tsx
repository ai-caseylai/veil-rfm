import type { Lang } from "../lib/i18n"

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  lang: Lang
}

export default function DateFilter({ from, to, onChange, lang }: Props) {
  const labels = {
    from: lang === "zh-TW" ? "開始" : lang === "zh-CN" ? "开始" : "From",
    to: lang === "zh-TW" ? "結束" : lang === "zh-CN" ? "结束" : "To",
    clear: lang === "zh-TW" ? "清除" : lang === "zh-CN" ? "清除" : "Clear",
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400">{labels.from}:</span>
      <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)}
        className="border border-white/20 bg-white/10 text-white rounded px-2 py-0.5 text-xs" />
      <span className="text-gray-400">{labels.to}:</span>
      <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)}
        className="border border-white/20 bg-white/10 text-white rounded px-2 py-0.5 text-xs" />
      {(from || to) && (
        <button onClick={() => onChange("", "")} className="text-gray-400 hover:text-white">{labels.clear}</button>
      )}
    </div>
  )
}
