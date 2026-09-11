import "server-only"

import { buildCandidates, configuredProviders, type Candidate, type Tier } from "./ai-providers"

// The app's one door to an LLM.
//
// Everything that talks to a model goes through here, so there is ONE place
// that knows the providers, the keys, the timeout and the error shape.
//
// A CALLER NAMES A TIER, NOT A MODEL. What actually answers is whatever is
// reachable: `lib/ai-providers.ts` turns the tier into an ordered list of
// (provider, model, key) and this walks it until one works. That indirection is
// not architecture for its own sake - a free tier can refuse a model it happily
// lists (a per-model quota of zero answers every request with 429), one key can
// be rate limited while another on the same account is fine, and a provider can
// simply be down. With one key and one model each of those killed the feature.
//
// Keys live in env and never reach the client - not in a response, not in a log
// line. Failures are logged by POSITION ("groq#2"), never by value.

/** Tiers, not model names. See CHAINS in ai-providers.ts for what each maps to. */
export const AI_MODEL_FAST: Tier = "fast"
export const AI_MODEL_SMART: Tier = "smart"

/**
 * How long one candidate gets. AI_TIMEOUT_MS raises it for deployments running
 * a big reasoning model - a 550B answers in ~25s, so the 20s default would
 * abort it every time and quietly fall through to something smaller.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000

// A shared free tier returns 429 under load and clears in a second or two.
// Without a retry every such blip surfaced as a dead "Couldn't generate the
// report", which is what it looked like when the very next request succeeded.
const MAX_ATTEMPTS = 2
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])

/**
 * Statuses where a DIFFERENT candidate is worth trying.
 *
 * 400 and 422 are absent on purpose: a malformed request fails identically
 * everywhere, so walking the list would multiply one error by twelve and slow
 * the failure down. 401/403 ARE included - they are per key, and the whole
 * point of a second key is that the first one might be rejected.
 */
const FALL_THROUGH = new Set([401, 403, 404, 408, 429, 500, 502, 503, 504])

/**
 * Candidates known to be refusing us, and when they are worth asking again.
 *
 * Keyed by candidate id ("groq#2:llama-3.3-70b"), so a key that is rate limited
 * does not bench its sibling and a model with no quota does not bench the key
 * for other models. Per-process, deliberately short-lived: a latency
 * optimisation, not a source of truth, and it has to expire so that a restored
 * plan or a reset quota starts being used again on its own.
 */
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

/**
 * What the USER is told. The provider's own wording is logged but never
 * forwarded - it leaks vendor details and reads as a bug in our app.
 */
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

/** True when ANY provider has at least one key. */
export function isAiConfigured(): boolean {
  return configuredProviders(process.env).length > 0
}

/** Which providers are set up, and how many keys each has. Never the keys. */
export function aiProviderStatus(): { id: string; keys: number }[] {
  return configuredProviders(process.env)
}

interface CompleteOptions {
  system: string
  user: string
  /** A tier. A raw model id still works: it is used as-is on its provider. */
  model?: string
  temperature?: number
  maxTokens?: number
  /** Ask the model for a JSON object and parse it. */
  json?: boolean
  timeoutMs?: number
}

/** One candidate, with a short retry for the blips that clear on their own. */
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
      // Abort => timeout; anything else => network/DNS. Both are worth trying
      // the next candidate for, so they carry a fall-through status.
      //
      // Benched, and that is not a nicety: a candidate too slow to finish costs
      // the WHOLE timeout, and without this it costs it again on every single
      // request rather than once.
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

    // The provider's reason, server-side only. `c.id` names the key by
    // position, so no key material can reach a log.
    const detail = await res.text().catch(() => "")
    console.error(`[ai] ${c.id} -> ${res.status}`, detail.slice(0, 200))

    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS - 1) {
      // A 429 with no Retry-After is not a busy moment - it is this key's quota
      // on this model being zero or spent. Bench it so the next request goes
      // straight past instead of paying for the same refusal again.
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

/**
 * One chat completion. Returns the assistant's text (or the parsed object when
 * `json` is set). Throws AiNotConfiguredError / AiError - callers decide the
 * HTTP status, because "AI is down" should never take a whole page with it.
 */
export async function aiComplete<T = string>(opts: CompleteOptions): Promise<T> {
  const requested = opts.model ?? AI_MODEL_FAST
  const tier: Tier = requested === "smart" ? "smart" : "fast"
  let candidates = buildCandidates(tier, process.env)

  // A caller naming an actual model still gets exactly that model, on whichever
  // configured providers list it - the tier chains are a default, not a cage.
  if (requested !== "fast" && requested !== "smart") {
    const exact = candidates.filter((c) => c.model === requested)
    if (exact.length > 0) candidates = exact
  }

  if (candidates.length === 0) throw new AiNotConfiguredError()

  const now = Date.now()
  const ready = candidates.filter((c) => (benched.get(c.id) ?? 0) <= now)
  // Everything is benched: try the last one anyway rather than failing without
  // asking. A bench is a guess about the near future, not a fact.
  const queue = ready.length > 0 ? ready : [candidates[candidates.length - 1]!]

  const startedAt = Date.now()
  let text: string | null = null
  let lastError: AiError | null = null

  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!
    try {
      text = await callCandidate(c, opts)
      // Logged EVERY time, not just after a fallback: which model answered is
      // the first thing worth knowing when somebody says a brand report reads
      // differently today, and the chain makes that vary by request.
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
    // Out of candidates. If every one of them is benched, this is not a passing
    // blip and "try again in a few seconds" would send people into a loop.
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
