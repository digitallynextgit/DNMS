import "server-only"

import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import type { ProviderRow } from "./ai-providers"

// The AI providers and keys admins set up in Admin -> AI Models, decrypted for lib/ai.ts. Platform-
// wide rows. Cached briefly: every AI task reads them, and the dev machine shares the database.

const TTL_MS = 30_000
let cache: { at: number; rows: ProviderRow[] } | null = null

export async function loadAiProviders(): Promise<ProviderRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows
  const rows = await db.aiProvider.findMany({
    include: { keys: { select: { id: true, secret: true, isActive: true, position: true } } },
  })
  const out: ProviderRow[] = rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    baseUrl: p.baseUrl,
    fastModels: p.fastModels,
    smartModels: p.smartModels,
    isDefault: p.isDefault,
    isActive: p.isActive,
    position: p.position,
    // A key that no longer decrypts (ENCRYPTION_KEY changed) is useless; drop it rather than send junk.
    keys: p.keys
      .map((k) => ({ ...k, secret: tryDecrypt(k.secret) ?? "" }))
      .filter((k) => k.secret !== ""),
  }))
  cache = { at: Date.now(), rows: out }
  return out
}

/** After an admin change, so this server uses it at once (others within TTL_MS). */
export function invalidateAiProviders(): void {
  cache = null
}

/** Best effort: the card's "last used" / "last error" line. Never fails the AI task itself. */
export function recordKeyOutcome(keyId: string, error: string | null): void {
  const now = new Date()
  void db.aiProviderKey
    .update({
      where: { id: keyId },
      data: error
        ? { lastError: error.slice(0, 300), lastErrorAt: now }
        : { lastUsedAt: now, lastError: null },
    })
    .catch(() => {})
}
