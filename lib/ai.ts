import "server-only"

// Single AI provider for the whole app: Mistral.
//
// Everything that talks to an LLM goes through here so there is ONE place that
// knows the provider, the key, the timeout and the error shape. (This replaced a
// one-off Groq call inlined in the job-description route, whose key was never
// configured - so that feature had been silently dead in production.)
//
// The key lives in MISTRAL_API_KEY and is never sent to the client.

const API_URL = "https://api.mistral.ai/v1/chat/completions"

/** Cheap + fast; good enough for rewriting and structured extraction. Bump to
 *  `mistral-medium-latest` per-call for reasoning-heavy work (e.g. CV ranking). */
export const AI_MODEL_FAST = "mistral-small-latest"
export const AI_MODEL_SMART = "mistral-medium-latest"

const DEFAULT_TIMEOUT_MS = 20_000

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
  return !!process.env.MISTRAL_API_KEY
}

interface CompleteOptions {
  system: string
  user: string
  model?: string
  temperature?: number
  maxTokens?: number
  /** Ask the model for a JSON object and parse it. */
  json?: boolean
  timeoutMs?: number
}

/**
 * One chat completion. Returns the assistant's text (or the parsed object when
 * `json` is set). Throws AiNotConfiguredError / AiError - callers decide the
 * HTTP status, because "AI is down" should never take a whole page with it.
 */
export async function aiComplete<T = string>(opts: CompleteOptions): Promise<T> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new AiNotConfiguredError()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model ?? AI_MODEL_FAST,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 500,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    })
  } catch (err) {
    // Abort => timeout; anything else => network/DNS.
    const timedOut = (err as Error)?.name === "AbortError"
    throw new AiError(timedOut ? "AI request timed out" : "AI provider unreachable", 504)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    // Log the provider's reason server-side; never leak it (or the key) to the client.
    const detail = await res.text().catch(() => "")
    console.error("[ai] provider error", res.status, detail.slice(0, 300))
    throw new AiError("AI provider returned an error", res.status)
  }

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const text = body?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new AiError("AI returned an empty response", 502)

  if (!opts.json) return text as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiError("AI returned malformed JSON", 502)
  }
}
