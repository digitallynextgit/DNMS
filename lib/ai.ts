import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { loadAiProviders, recordKeyOutcome } from "./ai-models"
import {
  AI_KINDS,
  buildCandidates,
  type Candidate,
  type ProviderRow,
  type Tier,
} from "./ai-providers"

// The app's one door to an LLM. Callers name a tier; the providers and keys set up in Admin -> AI
// Models are tried default-first until one works. Keys never reach the client or a log (logged by
// position, "gemini#2").

export const AI_MODEL_FAST: Tier = "fast"
export const AI_MODEL_SMART: Tier = "smart"

/** Per candidate. Raise AI_TIMEOUT_MS for big reasoning models (a 550B takes ~25s). */
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000
/** Claude's larger models think before answering, which takes longer. */
const CLAUDE_TIMEOUT_MS = Math.max(DEFAULT_TIMEOUT_MS, 60_000)
/** Above this a non-streamed request risks the SDK's long-request guard. */
const MAX_OUTPUT_TOKENS = 16_000

/** For services without a JSON mode: the instruction does the job, parseJsonReply strips fences. */
const JSON_ONLY = "Reply with one JSON object only - no prose and no code fences."

/** The caller's limit plus room for the model's reasoning, which counts against it. */
function outputTokens(c: Candidate, opts: CompleteOptions): number {
  return Math.min(MAX_OUTPUT_TOKENS, (opts.maxTokens ?? 500) + (AI_KINDS[c.kind].thinkingRoom ?? 0))
}

// Shared free tiers return brief 429s under load that clear in a second or two.
const MAX_ATTEMPTS = 2
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529])

/** Worth trying another candidate for. 400/422 fail the same everywhere; 401/403 are per key. */
const FALL_THROUGH = new Set([401, 403, 404, 408, 429, 500, 502, 503, 504, 529])

/** Candidates refusing us (by candidate id) and until when. Per-process and short-lived on purpose. */
const benched = new Map<string, number>()
const BENCH_MS = 10 * 60_000
/** A timeout is worth re-checking sooner than a quota: it is often just load. */
const SLOW_BENCH_MS = 2 * 60_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** What the user sees. The provider's own wording is only logged - it leaks vendor details. */
function providerMessage(status?: number): string {
  if (status === 429) return "The AI service is busy right now. Try again in a few seconds."
  if (status === 401 || status === 403) return "The AI service rejected our credentials"
  if (status && status >= 500) return "The AI service is temporarily unavailable"
  return "AI provider returned an error"
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI is not set up yet. An admin can add a provider under Admin -> AI Models."

export class AiNotConfiguredError extends Error {
  constructor() {
    super(AI_NOT_CONFIGURED_MESSAGE)
    this.name = "AiNotConfiguredError"
  }
}
export class AiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    /** The provider's own wording: for admins (the Test button), never shown to everyone. */
    public readonly detail?: string,
  ) {
    super(message)
    this.name = "AiError"
  }
}

/** True when at least one provider with a working key is switched on. */
export async function isAiConfigured(): Promise<boolean> {
  const rows = await loadAiProviders()
  return buildCandidates(rows, "fast").length > 0 || buildCandidates(rows, "smart").length > 0
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

type Outcome =
  | { kind: "ok"; text: string }
  | { kind: "http"; status: number; retryAfterSec: number | null; detail: string }
  | { kind: "network"; timedOut: boolean }

function retryAfterSec(value: string | null | undefined): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Honour Retry-After when the provider sends one, else 0.6s, 1.2s... */
function retryDelayMs(attempt: number, last: Outcome | null): number {
  const after = last?.kind === "http" ? last.retryAfterSec : null
  if (after) return Math.min(after * 1000, 5_000)
  return Math.min(600 * 2 ** attempt, 5_000)
}

async function sendOpenAiCompatible(
  c: Candidate,
  opts: CompleteOptions,
  timeoutMs: number,
): Promise<Outcome> {
  const kind = AI_KINDS[c.kind]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(c.url!, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.key}`,
        ...c.headers,
      },
      body: JSON.stringify({
        model: c.model,
        messages: [
          {
            role: "system",
            content: opts.json && kind.noJsonMode ? `${opts.system}\n\n${JSON_ONLY}` : opts.system,
          },
          { role: "user", content: opts.user },
        ],
        ...(kind.noTemperature ? {} : { temperature: opts.temperature ?? 0.3 }),
        [kind.tokenParam ?? "max_tokens"]: outputTokens(c, opts),
        ...(opts.json && !kind.noJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    })
  } catch (err) {
    return { kind: "network", timedOut: (err as Error)?.name === "AbortError" }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    return {
      kind: "http",
      status: res.status,
      retryAfterSec: retryAfterSec(res.headers.get("retry-after")),
      detail: await res.text().catch(() => ""),
    }
  }
  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const text = body?.choices?.[0]?.message?.content?.trim()
  return text
    ? { kind: "ok", text }
    : { kind: "http", status: 502, retryAfterSec: null, detail: "empty response" }
}

async function sendClaude(
  c: Candidate,
  opts: CompleteOptions,
  timeoutMs: number,
): Promise<Outcome> {
  // Our own loop retries and falls through, so the SDK must not retry on its own as well.
  const client = new Anthropic({ apiKey: c.key, maxRetries: 0, timeout: timeoutMs })
  try {
    const res = await client.messages.create({
      model: c.model,
      max_tokens: outputTokens(c, opts),
      // No temperature: current Claude models reject sampling parameters.
      system: opts.json ? `${opts.system}\n\n${JSON_ONLY}` : opts.system,
      messages: [{ role: "user", content: opts.user }],
    })
    if (res.stop_reason === "refusal") {
      return { kind: "http", status: 422, retryAfterSec: null, detail: "refused" }
    }
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
    return text
      ? { kind: "ok", text }
      : { kind: "http", status: 502, retryAfterSec: null, detail: "empty response" }
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError)
      return { kind: "network", timedOut: true }
    if (err instanceof Anthropic.APIConnectionError) return { kind: "network", timedOut: false }
    if (err instanceof Anthropic.APIError) {
      return {
        kind: "http",
        status: err.status ?? 500,
        retryAfterSec: retryAfterSec(err.headers?.get("retry-after")),
        detail: err.message,
      }
    }
    throw err
  }
}

/** One candidate, with a retry for a brief 429/5xx. Benches it (and records why) when it gives up. */
async function callCandidate(c: Candidate, opts: CompleteOptions): Promise<string> {
  const timeoutMs =
    opts.timeoutMs ?? (c.transport === "anthropic" ? CLAUDE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
  let last: Outcome | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(attempt - 1, last))
    const out =
      c.transport === "anthropic"
        ? await sendClaude(c, opts, timeoutMs)
        : await sendOpenAiCompatible(c, opts, timeoutMs)

    if (out.kind === "ok") {
      recordKeyOutcome(c.keyId, null)
      return out.text
    }

    if (out.kind === "network") {
      // Bench timeouts too, or a slow candidate costs the full timeout on every request.
      benched.set(c.id, Date.now() + SLOW_BENCH_MS)
      const why = out.timedOut ? "timed out" : "unreachable"
      console.warn(`[ai] benching ${c.id} for ${SLOW_BENCH_MS / 60_000}m (${why})`)
      recordKeyOutcome(c.keyId, `The service ${why}`)
      throw new AiError(
        out.timedOut ? "AI request timed out" : "AI provider unreachable",
        504,
        `The service ${why}`,
      )
    }

    console.error(`[ai] ${c.id} -> ${out.status}`, out.detail.slice(0, 200))
    last = out
    if (!RETRYABLE.has(out.status) || attempt === MAX_ATTEMPTS - 1) {
      // A 429 without Retry-After means this key's quota on this model is spent - bench it.
      if (out.retryAfterSec) {
        benched.set(c.id, Date.now() + Math.min(out.retryAfterSec * 1000, BENCH_MS))
      } else if ([401, 403, 404, 429].includes(out.status)) {
        benched.set(c.id, Date.now() + BENCH_MS)
      }
      const detail = `HTTP ${out.status}: ${out.detail.slice(0, 200) || "no details"}`
      recordKeyOutcome(c.keyId, detail)
      throw new AiError(providerMessage(out.status), out.status, detail)
    }
  }
  // Unreachable: the loop returns or throws on its last attempt.
  throw new AiError(providerMessage(), 502)
}

/** Some models wrap JSON in a ```json fence even when asked not to. */
function parseJsonReply<T>(text: string): T {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  return JSON.parse(fenced ? fenced[1]! : text) as T
}

/** Returns the text, or the parsed object with `json`. Throws AiNotConfiguredError / AiError; callers pick the HTTP status. */
export async function aiComplete<T = string>(opts: CompleteOptions): Promise<T> {
  const requested = opts.model ?? AI_MODEL_FAST
  const tier: Tier = requested === "smart" ? "smart" : "fast"
  let candidates = buildCandidates(await loadAiProviders(), tier)

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
    return parseJsonReply<T>(text)
  } catch {
    throw new AiError("AI returned malformed JSON", 502)
  }
}

export interface KeyTestResult {
  ok: boolean
  model: string | null
  ms: number
  error: string | null
}

/** Admin -> AI Models "Test": one short request on one key, with no fallback to other keys. */
export async function testAiKey(provider: ProviderRow, keyId: string): Promise<KeyTestResult> {
  const only = { ...provider, isActive: true, keys: provider.keys.filter((k) => k.id === keyId) }
  const candidate =
    buildCandidates([only], "fast")[0] ?? buildCandidates([only], "smart")[0] ?? null
  if (!candidate) {
    return { ok: false, model: null, ms: 0, error: "No model is set for this provider" }
  }
  // Fresh result: a key benched by an earlier failure must still be tried.
  benched.delete(candidate.id)
  const started = Date.now()
  try {
    await callCandidate(candidate, {
      system: "You are a connection check.",
      user: "Reply with the single word OK.",
      maxTokens: 20,
    })
    return { ok: true, model: candidate.model, ms: Date.now() - started, error: null }
  } catch (e) {
    return {
      ok: false,
      model: candidate.model,
      ms: Date.now() - started,
      error:
        e instanceof AiError ? (e.detail ?? e.message) : e instanceof Error ? e.message : String(e),
    }
  }
}
