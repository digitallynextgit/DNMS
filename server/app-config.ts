import "server-only"
import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"

// Admin-editable config: `app_settings` rows (secrets decrypted, cached), else process.env.

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
    return cache
  } catch {
    // DB hiccup: env only for this call, and not cached, so the next call retries.
    return {}
  }
}

export async function getConfig(key: string): Promise<string | undefined> {
  const m = await load()
  return m[key] || process.env[key]
}

/** For callers that can't await: cached values only (see warmConfig), else env. */
export function getConfigSync(key: string): string | undefined {
  return cache?.[key] || process.env[key]
}

export async function warmConfig(): Promise<void> {
  await load()
}

/** Called after the admin saves settings. */
export async function reloadConfig(): Promise<void> {
  cache = null
  await load()
}
