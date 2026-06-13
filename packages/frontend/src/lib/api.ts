const API_BASE = "https://veil-rfm-api.ai-caseylai.workers.dev"

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? "API request failed")
  }
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? "API request failed")
  }
  return res.json()
}

/** Load pre-computed RFM + Transition for N synthetic customers (no raw txns transferred) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPrecomputedRFM(opts: { n?: number; seed?: number; startDate?: string; endDate?: string; offset?: number; limit?: number } = {}): Promise<{
  stats: { customers: number; orders: number; rows: number; elapsedMs: number }
  rfm: Record<string, any>
  transition: Record<string, any>
}> {
  const params = new URLSearchParams()
  if (opts.n) params.set("n", String(opts.n))
  if (opts.seed) params.set("seed", String(opts.seed))
  if (opts.startDate) params.set("startDate", opts.startDate)
  if (opts.endDate) params.set("endDate", opts.endDate)
  if (opts.offset) params.set("offset", String(opts.offset))
  if (opts.limit) params.set("limit", String(opts.limit))
  return get(`/api/generate/rfm?${params.toString()}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeRFM(body: unknown): Promise<Record<string, any>> {
  return post("/api/rfm", body)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeTransition(body: unknown): Promise<Record<string, any>> {
  return post("/api/rfm/transition", body)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computePredict(body: unknown): Promise<Record<string, any>> {
  return post("/api/rfm/predict", body)
}
