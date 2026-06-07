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
