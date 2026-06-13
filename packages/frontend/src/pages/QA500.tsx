import { useEffect, useState, useMemo } from "react"

interface QAItem {
  id: number
  question: string
  answer: string
}

interface QACategory {
  category: string
  questions: QAItem[]
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h4 class='qa-subheading'>$1</h4>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
}

export default function QA500({ onAskChatbot }: { onAskChatbot?: (q: string) => void }) {
  const [categories, setCategories] = useState<QACategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [expandedQA, setExpandedQA] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/data/qa-500.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => { setCategories(data); setExpandedCat(data[0]?.category ?? null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (qa) =>
            qa.question.toLowerCase().includes(q) ||
            qa.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.questions.length > 0)
  }, [categories, search])

  const toggleQA = (key: string) => {
    setExpandedQA((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  if (loading) return <div className="p-6"><div className="skeleton h-6 w-48 mb-4" /><div className="skeleton h-4 w-full mb-2" /><div className="skeleton h-4 w-3/4 mb-2" /></div>
  if (error) return <div className="p-6 text-[var(--danger)]">Error: {error}</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--primary)]">Q&amp;A 500</h2>
        <input
          type="text"
          placeholder="Search questions & answers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[var(--border)] rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-[var(--muted)] py-12">No matching questions found.</div>
      )}

      <div className="space-y-3">
        {filtered.map((cat) => {
          const isCatOpen = expandedCat === cat.category
          return (
            <div key={cat.category} className="bg-white rounded-lg border border-[var(--border)] shadow-sm">
              <button
                onClick={() => setExpandedCat(isCatOpen ? null : cat.category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg"
              >
                <span className="font-semibold text-sm text-[var(--primary)]">
                  {cat.category}
                  <span className="ml-2 text-xs text-[var(--muted)] font-normal">
                    ({cat.questions.length} questions)
                  </span>
                </span>
                <span className={`text-[var(--muted)] transition-transform ${isCatOpen ? "rotate-90" : ""}`}>
                  ▸
                </span>
              </button>

              {isCatOpen && (
                <div className="border-t border-[var(--border)] px-4 py-2 space-y-1 max-h-[70vh] overflow-y-auto">
                  {cat.questions.map((qa) => {
                    const key = `${cat.category}-${qa.id}`
                    const isOpen = expandedQA.has(key)
                    return (
                      <div key={key} className="border-b border-[var(--border)] last:border-0 py-1">
                        <div className="flex items-start gap-1">
                          <button
                            onClick={() => toggleQA(key)}
                            className="flex items-start gap-2 py-1.5 text-left hover:text-[var(--accent)] transition-colors flex-1"
                          >
                            <span className={`text-[10px] mt-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                              ▸
                            </span>
                            <span className="text-sm font-medium flex-1">
                              <span className="text-[var(--muted)] mr-1">#{qa.id}</span>
                              {qa.question}
                            </span>
                          </button>
                          {onAskChatbot && (
                            <button
                              onClick={() => onAskChatbot(qa.question)}
                              className="mt-1 text-[10px] px-2 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors whitespace-nowrap"
                              title="Ask ChatBot"
                            >
                              Ask →
                            </button>
                          )}
                        </div>
                        {isOpen && (
                          <div
                            className="qa-answer pl-5 pr-2 pb-3 text-sm text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: `<p>${renderMarkdown(qa.answer)}</p>`,
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .qa-answer ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .qa-answer li { margin-bottom: 0.125rem; }
        .qa-answer strong { color: var(--primary); }
        .qa-answer p { margin-bottom: 0.5rem; }
        .qa-answer p:last-child { margin-bottom: 0; }
        .qa-subheading { font-size: 0.8125rem; font-weight: 600; color: var(--primary); margin: 0.5rem 0 0.25rem; }
      `}</style>
    </div>
  )
}
