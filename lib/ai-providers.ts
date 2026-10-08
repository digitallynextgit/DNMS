// Which provider, model and key to try, in what order. Pure and env-driven; lib/ai.ts makes the calls.

/** What a caller asks for: a capability, not a model name. */
export type Tier = "fast" | "smart"

export interface Provider {
  id: string
  /** OpenAI-compatible chat-completions endpoint. All of these speak it. */
  url: string
  /** Env names read for keys, in order (singular and plural both work). */
  keyEnv: readonly string[]
  /** Best first. Overridable per deployment - see `modelsFor`. */
  models: Record<Tier, readonly string[]>
  headers?: Record<string, string>
}

/** Declaration order is the default try order (override with AI_PROVIDER_ORDER). */
export const PROVIDERS: readonly Provider[] = [
  {
    id: "mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    keyEnv: ["MISTRAL_API_KEY", "MISTRAL_API_KEYS"],
    models: {
      smart: ["mistral-medium-latest", "ministral-14b-latest", "ministral-8b-latest"],
      fast: ["mistral-small-latest", "ministral-8b-latest", "ministral-3b-latest"],
    },
  },
  {
    id: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: ["GROQ_API_KEY", "GROQ_API_KEYS"],
    models: {
      smart: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
      fast: ["openai/gpt-oss-20b", "llama-3.1-8b-instant"],
    },
  },
  {
    id: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: ["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"],
    // The 550B is last: no better than the 8B in tests, ~10x slower and often overloaded.
    // Excluded: thinkingmachines/inkling* (403, agentic only), nemotron-3.5-lightning (leaks its reasoning).
    models: {
      smart: [
        "nex-agi/nex-n2.5-pro:free",
        "nex-agi/nex-n2.5-mini:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free",
      ],
      fast: ["nex-agi/nex-n2.5-mini:free", "nex-agi/nex-n2.5-pro:free"],
    },
    // OpenRouter attributes usage to a site; neither header is required.
    headers: { "X-Title": "DNMS" },
  },
  {
    id: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: ["GEMINI_API_KEY", "GEMINI_API_KEYS", "GOOGLE_AI_API_KEY"],
    models: {
      smart: ["gemini-flash-latest"],
      fast: ["gemini-flash-lite-latest"],
    },
  },
  {
    id: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: ["CEREBRAS_API_KEY", "CEREBRAS_API_KEYS"],
    models: {
      smart: ["llama-3.3-70b"],
      fast: ["llama3.1-8b"],
    },
  },
]

export type Env = Record<string, string | undefined>

/** Split on commas and whitespace (keys get pasted in any shape), deduplicated. */
export function readKeys(provider: Provider, env: Env): string[] {
  const raw = provider.keyEnv.map((name) => env[name] ?? "").join(",")
  const seen = new Set<string>()
  for (const part of raw.split(/[,\s]+/)) {
    const key = part.trim()
    if (key) seen.add(key)
  }
  return [...seen]
}

/** `AI_MODELS_<PROVIDER>_<TIER>` overrides the built-in list, so a retired model is fixed without a deploy. */
export function modelsFor(provider: Provider, tier: Tier, env: Env): string[] {
  const override = env[`AI_MODELS_${provider.id.toUpperCase()}_${tier.toUpperCase()}`]
  if (override?.trim()) {
    const list = override
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
    if (list.length > 0) return list
  }
  return [...provider.models[tier]]
}

/** AI_PROVIDER_ORDER when set, else declaration order. Unknown names are ignored, not thrown. */
export function providerOrder(env: Env): Provider[] {
  const raw = env.AI_PROVIDER_ORDER?.trim()
  if (!raw) return [...PROVIDERS]
  const wanted = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const named = wanted
    .map((id) => PROVIDERS.find((p) => p.id === id))
    .filter((p): p is Provider => Boolean(p))
  const rest = PROVIDERS.filter((p) => !named.includes(p))
  return [...named, ...rest]
}

export interface Candidate {
  provider: string
  url: string
  model: string
  key: string
  headers?: Record<string, string>
  /** Names the key by position ("groq#2") so key material never reaches a log. */
  id: string
}

/** Provider, then model, then key: every key gets a turn at a model, because a 429 is per key. */
export function buildCandidates(tier: Tier, env: Env): Candidate[] {
  const out: Candidate[] = []
  for (const provider of providerOrder(env)) {
    const keys = readKeys(provider, env)
    if (keys.length === 0) continue
    for (const model of modelsFor(provider, tier, env)) {
      keys.forEach((key, i) => {
        out.push({
          provider: provider.id,
          url: provider.url,
          model,
          key,
          headers: provider.headers,
          id: `${provider.id}#${i + 1}:${model}`,
        })
      })
    }
  }
  return out
}

export function configuredProviders(env: Env): { id: string; keys: number }[] {
  return providerOrder(env)
    .map((p) => ({ id: p.id, keys: readKeys(p, env).length }))
    .filter((p) => p.keys > 0)
}
