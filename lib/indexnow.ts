import "server-only"

import { getConfig } from "@/server/app-config"

// =============================================================================
// IndexNow - a free protocol (Bing, Yandex, Seznam, Naver) for pushing "this URL
// changed, please recrawl" instantly, instead of waiting to be crawled. One key
// per host, served as a text file at the site root.
//
// Config (Admin -> Integrations): INDEXNOW_KEY - a 8-128 char hex key. The site
// must host it at https://<host>/<key>.txt containing exactly the key. Without
// that file the endpoints reject the submission (422), so we surface that.
// =============================================================================

const ENDPOINT = "https://api.indexnow.org/indexnow"
const TIMEOUT_MS = 15_000
const MAX_URLS = 10_000 // IndexNow's per-request cap

export async function isIndexNowConfigured(): Promise<boolean> {
  return !!(await getConfig("INDEXNOW_KEY"))
}

export interface IndexNowResult {
  ok: boolean
  submitted: number
  status: number
  error?: string
}

/**
 * Submit changed URLs for a host. All URLs must belong to `host`. Returns a
 * result object rather than throwing - a failed ping should never break the
 * flow that triggered it (a deploy, a publish).
 */
export async function submitToIndexNow(host: string, urls: string[]): Promise<IndexNowResult> {
  const key = await getConfig("INDEXNOW_KEY")
  if (!key) return { ok: false, submitted: 0, status: 0, error: "INDEXNOW_KEY not configured" }

  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  const list = urls.filter((u) => u.includes(cleanHost)).slice(0, MAX_URLS)
  if (list.length === 0)
    return { ok: false, submitted: 0, status: 0, error: "No URLs for this host" }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: cleanHost,
        key,
        keyLocation: `https://${cleanHost}/${key}.txt`,
        urlList: list,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // 200 = accepted, 202 = accepted (pending). 422 usually = key file missing.
    const ok = res.status === 200 || res.status === 202
    return {
      ok,
      submitted: ok ? list.length : 0,
      status: res.status,
      error: ok
        ? undefined
        : res.status === 422
          ? "Key file missing or invalid at the site root - host /<key>.txt"
          : `IndexNow returned HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      submitted: 0,
      status: 0,
      error: err instanceof Error ? err.message : "IndexNow request failed",
    }
  }
}
