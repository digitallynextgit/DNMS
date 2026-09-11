/**
 * Which model, from which provider, on which key - and in what order to try them.
 *
 * Pure and env-driven so the whole fallback order can be tested without a
 * network call, and changed without a deploy. `lib/ai.ts` does the calling.
 *
 * WHY THIS EXISTS: a free tier can refuse a single model while listing it (a
 * per-model quota of zero answers every request with 429), a key can be rate
 * limited while a second key on the same account is fine, and a whole provider
 * can go down. One key and one model made every one of those a dead feature.
 */

/** What a caller asks for: a capability, not a model name. */
export type Tier = "fast" | "smart"

export interface Provider {
  id: string
  /** OpenAI-compatible chat-completions endpoint. All of these speak it. */
  url: string
  /**
   * Env names read for keys, in order. Both the singular and plural spellings
   * are accepted so a second key never means renaming the first.
   */
  keyEnv: readonly string[]
  /** Best first. Overridable per deployment - see `modelsFor`. */
  models: Record<Tier, readonly string[]>
  /** Anything the provider wants beyond auth. */
  headers?: Record<string, string>
}

/**
 * Declaration order is the DEFAULT try order - roughly best-quality-first among
 * what these providers give away. Override with AI_PROVIDER_ORDER.
 *
 * The model ids are the part most likely to age: providers rename and retire
 * them without notice. That is why `modelsFor` lets env replace any list, so a
 * 404 is a one-line env fix rather than a deploy.
 */
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
    // Measured against the live catalogue on 10 Sep 2026.
    //
    // The 550B is last, not first, despite being by far the biggest model on
    // offer. Asked to rank three CVs it reached the SAME answer as the 8B in
    // front of it, took 17-25s against 1.7s, and was refused by the upstream
    // ("service temporarily overloaded") on two of two attempts. Biggest is not
    // best when it is ten times slower and often unavailable - but it is worth
    // having as a last resort, because a slow answer beats an error.
    //
    // Excluded entirely: thinkingmachines/inkling* (403, agentic harness only)
    // and nemotron-3.5-lightning (leaks its chain-of-thought into the reply).
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

/**
 * Every key configured for a provider, in order.
 *
 * Split on commas AND whitespace, because a list of keys gets pasted into an
 * env file in whatever shape the clipboard had it. Deduplicated, since the same
 * key in both MISTRAL_API_KEY and MISTRAL_API_KEYS should not be tried twice.
 */
export function readKeys(provider: Provider, env: Env): string[] {
  const raw = provider.keyEnv.map((name) => env[name] ?? "").join(",")
  const seen = new Set<string>()
  for (const part of raw.split(/[,\s]+/)) {
    const key = part.trim()
    if (key) seen.add(key)
  }
  return [...seen]
}

/**
 * The model list for a tier: `AI_MODELS_<PROVIDER>_<TIER>` when set, else the
 * built-in one. Env wins so a renamed or retired model is fixed without a
 * deploy - which is the failure these lists are most prone to.
 */
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

/**
 * Providers to try, in order: AI_PROVIDER_ORDER when set, else declaration
 * order. Unknown names are ignored rather than throwing - a typo in env should
 * not take AI down, and anything left out still follows in its default place.
 */
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

/** One thing to try: a provider, a model, and one of that provider's keys. */
export interface Candidate {
  provider: string
  url: string
  model: string
  key: string
  headers?: Record<string, string>
  /**
   * Safe to log and to use as a bench key. Names the key by POSITION only -
   * "groq#2" - so no key material can reach a log line.
   */
  id: string
}

/**
 * Everything worth trying for a tier, best first.
 *
 * Ordered provider, then model, then key: a provider's own chain is exhausted
 * before moving on, and every key gets a turn at a model before that model is
 * given up on - because a 429 is per key, not per model.
 */
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

/** Which providers have at least one key - for diagnostics, never with values. */
export function configuredProviders(env: Env): { id: string; keys: number }[] {
  return providerOrder(env)
    .map((p) => ({ id: p.id, keys: readKeys(p, env).length }))
    .filter((p) => p.keys > 0)
}
