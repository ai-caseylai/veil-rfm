import { useState, useRef, useEffect, useCallback } from "react"
import type { AppData } from "../App"
import type { Lang } from "../lib/i18n"

interface Props { data: AppData; lang: Lang; prefillQuestion?: string; onPrefillConsumed?: () => void }

interface Message { role: "user" | "assistant"; content: string }

const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

const GREETINGS: Record<Lang, string> = {
  en: "Hello! I'm your RFM analytics assistant powered by Qwen. Ask me about customers, segments, or run what-if simulations.",
  "zh-TW": "您好！我是由千問驅動的 RFM 分析助手。可以問我有關客戶、分群的問題，或進行情境模擬。",
  "zh-CN": "您好！我是由千问驱动的 RFM 分析助手。可以问我有关客户、分群的问题，或进行情景模拟。",
}

export default function ChatBot({ data, lang, prefillQuestion, onPrefillConsumed }: Props) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: GREETINGS[lang] }])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [width, setWidth] = useState(380)
  const [resizing, setResizing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight) }, [messages])

  const onMouseDown = useCallback(() => setResizing(true), [])
  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => setWidth(Math.max(300, Math.min(700, window.innerWidth - e.clientX)))
    const onUp = () => setResizing(false)
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [resizing])

  async function send(msg?: string) {
    const text = (msg ?? input).trim()
    if (!text || sending) return
    const userMsg: Message = { role: "user", content: text }
    const history = [...messages, userMsg]
    setMessages(history); setInput(""); setSending(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          seed: 20260603,
          transactions: [],
        }),
      })
      const json = await res.json()
      setMessages([...history, { role: "assistant", content: json.error ? `❌ ${json.error}` : json.reply || "(no response)" }])
    } catch (e) {
      setMessages([...history, { role: "assistant", content: `❌ ${String(e)}` }])
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (prefillQuestion && !sending) {
      setCollapsed(false)
      send(prefillQuestion)
      onPrefillConsumed?.()
    }
  }, [prefillQuestion])

  if (collapsed) {
    return (
      <div className="border-l bg-[var(--sidebar-bg)] flex flex-col items-center py-3" style={{ width: 36 }}>
        <button onClick={() => setCollapsed(false)} className="text-gray-400 hover:text-white text-xs">◀</button>
      </div>
    )
  }

  return (
    <div className="flex flex-row" style={{ width: width + 4 }}>
      <div onMouseDown={onMouseDown} className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors" style={{ userSelect: "none" }} />
      <div className="flex flex-col bg-white border-l h-full" style={{ width }}>
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Qwen Assistant</span>
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">AI</span>
          </div>
          <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-gray-600 text-xs">▶</button>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] rounded-lg px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "bg-[var(--accent)] text-white" : "bg-gray-100 text-gray-800"}`}
                dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/^- /gm, "• ").replace(/\n/g, "<br/>") }} />
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className="bg-gray-100 rounded-lg px-3 py-2"><span className="inline-flex gap-0.5"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} /></span></div></div>}
        </div>

        <div className="border-t p-2 flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={lang === "zh-TW" ? "輸入問題..." : lang === "zh-CN" ? "输入问题..." : "Ask anything..."}
            disabled={sending}
            className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-gray-100" />
          <button onClick={() => send()} disabled={sending || !input.trim()}
            className="btn btn-primary text-xs px-3 disabled:opacity-50">
            {sending ? "..." : lang === "zh-TW" ? "送出" : lang === "zh-CN" ? "发送" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
