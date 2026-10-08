import "server-only"

import { buildCandidates, configuredProviders, type Candidate, type Tier } from "./ai-providers"

// The app's one door to an LLM. Callers name a tier; ai-providers.ts orders the candidates and this
// walks them until one works. Keys never reach the client or a log (logged by position, "groq#2").

export const AI_MODEL_FAST: Tier = "fast"
export const AI_MODEL_SMART: Tier = "smart"

/** Per candidate. Raise AI_TIMEOUT_MS for big reasoning models (a 550B takes ~25s). */
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000

// Shared free tiers return brief 429s under load that clear in a second or two.
const MAX_ATTEMPTS = 2
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])

/** Worth trying another candidate for. 400/422 fail the same everywhere; 401/403 are per key. */
const FALL_THROUGH = new Set([401, 403, 404, 408, 429, 500, 502, 503, 504])

/** Candidates refusing us (by candidate id) and until when. Per-process and short-lived on purpose. */
const benched = new Map<string, number>()
const BENCH_MS = 10 * 60_000
/** A timeout is worth re-checking sooner than a quota: it is often just load. */
const SLOW_BENCH_MS = 2 * 60_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Honour Retry-After when the provider sends one, else 0.6s. */
function retryDelayMs(attempt: number, res: Response | null): number {
  const header = Number(res?.headers.get("retry-after"))
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 5_000)
  return Math.min(600 * 2 ** attempt, 5_000)
}

/** What the user sees. The provider's own wording is only logged - it leaks vendor details. */
function providerMessage(status?: number): string {
  if (status === 429) return "The AI service is busy right now. Try again in a few seconds."
  if (status === 401 || status === 403) return "The AI service rejected our credentials"
  if (status && status >= 500) return "The AI service is temporarily unavailable"
  return "AI provider returned an error"
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured on the server")
    this.name = "AiNotConfiguredError"
  }
}
export class AiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "AiError"
  }
}

export function isAiConfigured(): boolean {
  return configuredProviders(process.env).length > 0
}

export function aiProviderStatus(): { id: string; keys: number }[] {
  return configuredProviders(process.env)
}

interface CompleteOptions {
  system: string
  user: string
  /** A tier, or a raw model id (used as-is). */
  model?: string
  temperature?: number
  maxTokens?: number
  json?: boolean
  timeoutMs?: number
}

async function callCandidate(c: Candidate, opts: CompleteOptions): Promise<string> {
  const payload = JSON.stringify({
    model: c.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 500,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  })

  let res: Response | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(attempt - 1, res))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    try {
      res = await fetch(c.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.key}`,
          ...c.headers,
        },
        body: payload,
      })
    } catch (err) {
      // Timeouts and network errors fall through. Bench them too, or a slow candidate costs the
      // full timeout on every request.
      const timedOut = (err as Error)?.name === "AbortError"
      benched.set(c.id, Date.now() + SLOW_BENCH_MS)
      console.warn(
        `[ai] benching ${c.id} for ${SLOW_BENCH_MS / 60_000}m (${timedOut ? "timeout" : "unreachable"})`,
      )
      throw new AiError(timedOut ? "AI request timed out" : "AI provider unreachable", 504)
    } finally {
      clearTimeout(timer)
    }

    if (res.ok) break

    const detail = await res.text().catch(() => "")
    console.error(`[ai] ${c.id} -> ${res.status}`, detail.slice(0, 200))

    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS - 1) {
      // A 429 without Retry-After means this key's quota on this model is spent - bench it.
      const retryAfter = Number(res.headers.get("retry-after"))
      const transient = Number.isFinite(retryAfter) && retryAfter > 0
      if (transient) {
        benched.set(c.id, Date.now() + Math.min(retryAfter * 1000, BENCH_MS))
      } else if ([401, 403, 404, 429].includes(res.status)) {
        benched.set(c.id, Date.now() + BENCH_MS)
      }
      throw new AiError(providerMessage(res.status), res.status)
    }
  }

  if (!res || !res.ok) throw new AiError(providerMessage(res?.status), res?.status)

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const text = body?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new AiError("AI returned an empty response", 502)
  return text
}

/** Returns the text, or the parsed object with `json`. Throws AiNotConfiguredError / AiError; callers pick the HTTP status. */
export async function aiComplete<T = string>(opts: CompleteOptions): Promise<T> {
  const requested = opts.model ?? AI_MODEL_FAST
  const tier: Tier = requested === "smart" ? "smart" : "fast"
  let candidates = buildCandidates(tier, process.env)

  // A real model name gets exactly that model, on any provider that lists it.
  if (requested !== "fast" && requested !== "smart") {
    const exact = candidates.filter((c) => c.model === requested)
    if (exact.length > 0) candidates = exact
  }

  if (candidates.length === 0) throw new AiNotConfiguredError()

  const now = Date.now()
  const ready = candidates.filter((c) => (benched.get(c.id) ?? 0) <= now)
  // All benched: try the last one anyway rather than fail without asking.
  const queue = ready.length > 0 ? ready : [candidates[candidates.length - 1]!]

  const startedAt = Date.now()
  let text: string | null = null
  let lastError: AiError | null = null

  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!
    try {
      text = await callCandidate(c, opts)
      // Logged on every call: which model answered varies by request.
      const ms = Date.now() - startedAt
      if (i > 0) console.warn(`[ai] served by ${c.id} in ${ms}ms (${i} unavailable first)`)
      else console.info(`[ai] served by ${c.id} in ${ms}ms`)
      break
    } catch (err) {
      if (!(err instanceof AiError)) throw err
      lastError = err
      const next = queue[i + 1]
      if (!next || !FALL_THROUGH.has(err.status ?? 0)) break
    }
  }

  if (text === null) {
    // All benched is not a passing blip, so don't tell people to retry in a few seconds.
    const allBenched = queue.every((c) => (benched.get(c.id) ?? 0) > Date.now())
    throw allBenched
      ? new AiError(
          "Every AI model and key configured for this app is currently refusing requests - check the provider quotas",
          lastError?.status ?? 429,
        )
      : (lastError ?? new AiError(providerMessage(), 502))
  }

  if (!opts.json) return text as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiError("AI returned malformed JSON", 502)
  }
}
