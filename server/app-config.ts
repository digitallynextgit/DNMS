import "server-only"
import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"

// Admin-editable runtime config resolver. Reads the `app_settings` table
// (secret values decrypted), cached in memory, and falls back to process.env
// for any key not overridden in the DB. Call sites read config through here
// instead of touching process.env directly, so the Integrations admin page can
// change values at runtime.

let cache: Record<string, string> | null = null

async function load(): Promise<Record<string, string>> {
  if (cache) return cache
  try {
    const rows = await db.appSetting.findMany()
    const map: Record<string, string> = {}
    for (const r of rows) {
      if (!r.value) continue
      map[r.key] = r.isSecret ? (tryDecrypt(r.value) ?? "") : r.value
    }
    cache = map
  } catch {
    // Table missing / DB hiccup → behave as if no overrides (pure env).
    cache = {}
  }
  return cache
}

/** Resolve a config value: DB setting (decrypted) first, then process.env. */
export async function getConfig(key: string): Promise<string | undefined> {
  const m = await load()
  return m[key] || process.env[key]
}

/**
 * Synchronous resolver for callers that can't await (e.g. email HTML builders).
 * Uses whatever is already cached, else env. Warm the cache first via
 * `warmConfig()` / any `getConfig()` call to ensure DB overrides are seen.
 */
export function getConfigSync(key: string): string | undefined {
  return cache?.[key] || process.env[key]
}

/** Ensure the cache is populated (await before sync reads that must see DB values). */
export async function warmConfig(): Promise<void> {
  await load()
}

/** Drop + reload the cache (called after the admin saves settings). */
export async function reloadConfig(): Promise<void> {
  cache = null
  await load()
}
