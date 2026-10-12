// The AI services DNMS can call, and the order it tries them in. Pure (no DB, no env), so the
// admin page and the tests import it too; lib/ai-models.ts loads the rows, lib/ai.ts makes the calls.

/** What a caller asks for: a capability, not a model name. */
export type Tier = "fast" | "smart"

export const AI_KIND_IDS = [
  "gemini",
  "anthropic",
  "openai",
  "mistral",
  "groq",
  "openrouter",
  "cerebras",
  "cloudflare",
  "custom",
] as const
export type AiKind = (typeof AI_KIND_IDS)[number]

export interface AiKindInfo {
  label: string
  /** Claude speaks its own API (through Anthropic's SDK); every other kind speaks OpenAI chat-completions. */
  transport: "openai" | "anthropic"
  /** Chat-completions URL. Custom providers bring their own. */
  url: string | null
  /** Suggested models for a new provider, best first. */
  models: Record<Tier, string>
  /** Where an admin gets a key. */
  keysUrl: string | null
  headers?: Record<string, string>
  /** OpenAI's newer models take max_completion_tokens and only their own temperature. */
  tokenParam?: "max_tokens" | "max_completion_tokens"
  noTemperature?: boolean
  /** Not every service accepts response_format; those get JSON by instruction only. */
  noJsonMode?: boolean
  /** The URL is per account (Cloudflare): the admin gives an Account ID and it's stored in baseUrl. */
  accountUrl?: (accountId: string) => string
  /** Extra output tokens for models that reason first: the reasoning counts against the limit. */
  thinkingRoom?: number
}

export const AI_KINDS: Record<AiKind, AiKindInfo> = {
  gemini: {
    label: "Google Gemini",
    transport: "openai",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: { fast: "gemini-flash-lite-latest", smart: "gemini-flash-latest" },
    keysUrl: "https://aistudio.google.com/apikey",
    thinkingRoom: 4_000,
  },
  anthropic: {
    label: "Anthropic Claude",
    transport: "anthropic",
    url: null,
    models: { fast: "claude-haiku-4-5", smart: "claude-opus-5-5" },
    keysUrl: "https://platform.claude.com/settings/keys",
    noTemperature: true,
    thinkingRoom: 8_000,
  },
  openai: {
    label: "OpenAI",
    transport: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    models: { fast: "gpt-5-mini", smart: "gpt-5" },
    keysUrl: "https://platform.openai.com/api-keys",
    tokenParam: "max_completion_tokens",
    noTemperature: true,
    thinkingRoom: 4_000,
  },
  mistral: {
    label: "Mistral",
    transport: "openai",
    url: "https://api.mistral.ai/v1/chat/completions",
    models: { fast: "mistral-small-latest", smart: "mistral-medium-latest" },
    keysUrl: "https://console.mistral.ai/api-keys",
  },
  groq: {
    label: "Groq",
    transport: "openai",
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: { fast: "openai/gpt-oss-20b", smart: "openai/gpt-oss-120b" },
    keysUrl: "https://console.groq.com/keys",
    thinkingRoom: 2_000,
  },
  openrouter: {
    label: "OpenRouter",
    transport: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: { fast: "nex-agi/nex-n2.5-mini:free", smart: "nex-agi/nex-n2.5-pro:free" },
    keysUrl: "https://openrouter.ai/settings/keys",
    // OpenRouter attributes usage to a site; not required.
    headers: { "X-Title": "DNMS" },
  },
  cerebras: {
    label: "Cerebras",
    transport: "openai",
    url: "https://api.cerebras.ai/v1/chat/completions",
    models: { fast: "llama3.1-8b", smart: "llama-3.3-70b" },
    keysUrl: "https://cloud.cerebras.ai",
  },
  cloudflare: {
    label: "Cloudflare Workers AI",
    transport: "openai",
    url: null,
    // Cloudflare retires models on a schedule; each tier keeps a backup.
    models: {
      fast: "@cf/meta/llama-3.1-8b-instruct-fp8, @cf/openai/gpt-oss-20b",
      smart: "@cf/openai/gpt-oss-120b, @cf/meta/llama-3.3-70b-instruct-fp8-fast",
    },
    keysUrl: "https://dash.cloudflare.com/?to=/:account/ai/workers-ai",
    noJsonMode: true,
    thinkingRoom: 2_000,
    accountUrl: (accountId) =>
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
  },
  custom: {
    label: "Other (OpenAI-compatible)",
    transport: "openai",
    url: null,
    models: { fast: "", smart: "" },
    keysUrl: null,
  },
}

export function isAiKind(v: unknown): v is AiKind {
  return typeof v === "string" && (AI_KIND_IDS as readonly string[]).includes(v)
}

/** "a, b ,,c" -> ["a", "b", "c"]: a tier lists backup models, tried in order. */
export function splitModels(list: string): string[] {
  return [
    ...new Set(
      list
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ),
  ]
}

/** A provider as lib/ai-models.ts loads it, keys decrypted. */
export interface ProviderRow {
  id: string
  kind: string
  label: string
  baseUrl: string | null
  fastModels: string
  smartModels: string
  isDefault: boolean
  isActive: boolean
  position: number
  keys: { id: string; secret: string; isActive: boolean; position: number }[]
}

export interface Candidate {
  providerId: string
  keyId: string
  kind: AiKind
  transport: AiKindInfo["transport"]
  /** Null for Claude, which goes through the SDK. */
  url: string | null
  model: string
  key: string
  headers?: Record<string, string>
  /** "gemini#2:gemini-flash-latest" - names the key by position, so key material never reaches a log. */
  id: string
}

/** The default provider first, then the rest by position: the order an AI task tries them in. */
export function orderProviders<T extends Pick<ProviderRow, "isDefault" | "position">>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.position - b.position,
  )
}

/**
 * Provider, then model, then key: every key gets a turn at a model, because quotas are per key.
 * Switched-off providers and keys, unknown kinds and custom providers without a URL are skipped.
 */
export function buildCandidates(rows: ProviderRow[], tier: Tier): Candidate[] {
  const out: Candidate[] = []
  for (const p of orderProviders(rows.filter((r) => r.isActive))) {
    if (!isAiKind(p.kind)) continue
    const info = AI_KINDS[p.kind]
    // Custom and per-account (Cloudflare) providers keep their URL on the row.
    const url = info.url ?? p.baseUrl
    if (info.transport === "openai" && !url) continue
    const keys = p.keys.filter((k) => k.isActive).sort((a, b) => a.position - b.position)
    for (const model of splitModels(tier === "smart" ? p.smartModels : p.fastModels)) {
      keys.forEach((k, i) => {
        out.push({
          providerId: p.id,
          keyId: k.id,
          kind: p.kind as AiKind,
          transport: info.transport,
          url,
          model,
          key: k.secret,
          headers: info.headers,
          id: `${p.kind}#${i + 1}:${model}`,
        })
      })
    }
  }
  return out
}
