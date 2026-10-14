import "server-only"

import type { Session } from "next-auth"

import { db } from "@/server/db"
import { encrypt } from "@/lib/crypto"
import { createAuditLog } from "@/lib/audit"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { testAiKey } from "@/lib/ai"
import { invalidateAiProviders, loadAiProviders } from "@/lib/ai-models"
import { AI_KINDS, isAiKind, orderProviders } from "@/lib/ai-providers"
import type {
  AiKeyCreateInput,
  AiKeyUpdateInput,
  AiProviderCreateInput,
  AiProviderUpdateInput,
} from "../schemas/ai-models.schema"
import type { AiKeyTest, AiProviderView } from "../types"

// Admin -> AI Models. Platform-wide rows (like storage accounts); routes check settings:write and
// platform scope. Keys are encrypted at rest and never returned - only their last 4 characters.

const KEY_VIEW = {
  id: true,
  label: true,
  last4: true,
  isActive: true,
  position: true,
  lastUsedAt: true,
  lastError: true,
  lastErrorAt: true,
  createdAt: true,
} as const

const iso = (d: Date | null) => d?.toISOString() ?? null

export async function listAiProviders(): Promise<AiProviderView[]> {
  const rows = await db.aiProvider.findMany({
    include: { keys: { select: KEY_VIEW, orderBy: { position: "asc" } } },
  })
  return orderProviders(rows).map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    baseUrl: p.baseUrl,
    fastModels: p.fastModels,
    smartModels: p.smartModels,
    isDefault: p.isDefault,
    isActive: p.isActive,
    position: p.position,
    keys: p.keys.map((k) => ({
      ...k,
      lastUsedAt: iso(k.lastUsedAt),
      lastErrorAt: iso(k.lastErrorAt),
      createdAt: k.createdAt.toISOString(),
    })),
  }))
}

const last4 = (key: string) => key.slice(-4)

/** The URL a row keeps: the admin's own for custom providers, built from the Account ID for Cloudflare. */
function urlFor(kind: string, v: { baseUrl?: string | null; accountId?: string | null }) {
  if (!isAiKind(kind)) return null
  if (kind === "custom") return v.baseUrl ?? null
  const build = AI_KINDS[kind].accountUrl
  return build && v.accountId ? build(v.accountId.toLowerCase()) : null
}

async function audit(session: Session, action: string, entityId: string, changes: object) {
  await createAuditLog(session, {
    action,
    module: "admin",
    entityType: "AiProvider",
    entityId,
    // Never a key: only what changed around it.
    changes,
  })
}

async function getProvider(id: string) {
  const p = await db.aiProvider.findUnique({ where: { id } })
  if (!p) throw new NotFoundError("AI provider")
  return p
}

export async function createAiProvider(session: Session, input: AiProviderCreateInput) {
  const [count, last] = await Promise.all([
    db.aiProvider.count(),
    db.aiProvider.findFirst({ orderBy: { position: "desc" }, select: { position: true } }),
  ])
  const provider = await db.aiProvider.create({
    data: {
      kind: input.kind,
      label: input.label,
      baseUrl: urlFor(input.kind, input),
      fastModels: input.fastModels,
      smartModels: input.smartModels,
      // The first provider is the default; later ones queue up as fallbacks.
      isDefault: count === 0,
      position: (last?.position ?? -1) + 1,
      keys: {
        create: {
          secret: encrypt(input.key),
          last4: last4(input.key),
          label: input.keyLabel || null,
          position: 0,
        },
      },
    },
  })
  invalidateAiProviders()
  await audit(session, "CREATE", provider.id, { kind: input.kind, label: input.label })
  return provider
}

/** Swap with the neighbour in the fallback order (the default always stays first). */
async function moveProvider(id: string, dir: "up" | "down") {
  const ordered = orderProviders(await db.aiProvider.findMany())
  const i = ordered.findIndex((p) => p.id === id)
  const j = dir === "up" ? i - 1 : i + 1
  const me = ordered[i]
  const other = ordered[j]
  if (!me || !other || me.isDefault || other.isDefault) return
  ordered[i] = other
  ordered[j] = me
  // Renumbered whole, so equal positions from older rows can't turn the swap into a no-op.
  await db.$transaction(
    ordered.map((p, position) => db.aiProvider.update({ where: { id: p.id }, data: { position } })),
  )
}

export async function updateAiProvider(session: Session, id: string, input: AiProviderUpdateInput) {
  const before = await getProvider(id)
  if (input.isActive === false && before.isDefault) {
    throw new ValidationError("Make another provider the default before switching this one off")
  }
  if (input.baseUrl !== undefined && before.kind !== "custom") {
    throw new ValidationError("Only an OpenAI-compatible provider has its own URL")
  }
  if (input.accountId !== undefined && before.kind !== "cloudflare") {
    throw new ValidationError("Only Cloudflare uses an Account ID")
  }

  if (input.isDefault) {
    await db.$transaction([
      db.aiProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      // A switched-off provider can't lead; making it the default switches it on.
      db.aiProvider.update({ where: { id }, data: { isDefault: true, isActive: true } }),
    ])
  }
  if (input.move) await moveProvider(id, input.move)

  const data = {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
    ...(input.accountId !== undefined ? { baseUrl: urlFor(before.kind, input) } : {}),
    ...(input.fastModels !== undefined ? { fastModels: input.fastModels } : {}),
    ...(input.smartModels !== undefined ? { smartModels: input.smartModels } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  }
  if (Object.keys(data).length > 0) await db.aiProvider.update({ where: { id }, data })

  invalidateAiProviders()
  await audit(session, "UPDATE", id, { label: before.label, ...input })
}

export async function deleteAiProvider(session: Session, id: string) {
  const p = await getProvider(id)
  await db.aiProvider.delete({ where: { id } })
  // The next in line takes over as default, so AI keeps working.
  if (p.isDefault) {
    const next = orderProviders(await db.aiProvider.findMany()).find((x) => x.isActive)
    if (next) await db.aiProvider.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  invalidateAiProviders()
  await audit(session, "DELETE", id, { kind: p.kind, label: p.label })
}

export async function addAiKey(session: Session, providerId: string, input: AiKeyCreateInput) {
  const p = await getProvider(providerId)
  const last = await db.aiProviderKey.findFirst({
    where: { providerId },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const key = await db.aiProviderKey.create({
    data: {
      providerId,
      secret: encrypt(input.key),
      last4: last4(input.key),
      label: input.label || null,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  })
  invalidateAiProviders()
  await audit(session, "UPDATE", providerId, { label: p.label, keyAdded: `…${last4(input.key)}` })
  return key
}

async function getKey(providerId: string, keyId: string) {
  const k = await db.aiProviderKey.findFirst({ where: { id: keyId, providerId } })
  if (!k) throw new NotFoundError("API key")
  return k
}

export async function updateAiKey(
  session: Session,
  providerId: string,
  keyId: string,
  input: AiKeyUpdateInput,
) {
  const k = await getKey(providerId, keyId)
  if (input.move) {
    const keys = await db.aiProviderKey.findMany({
      where: { providerId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })
    const i = keys.findIndex((x) => x.id === keyId)
    const other = keys[input.move === "up" ? i - 1 : i + 1]
    if (other) {
      // Renumbered on swap, so equal positions from older rows can't make it a no-op.
      const order = keys.map((x) => x.id)
      order[i] = other.id
      order[keys.indexOf(other)] = keyId
      await db.$transaction(
        order.map((id, position) => db.aiProviderKey.update({ where: { id }, data: { position } })),
      )
    }
  }
  const data = {
    ...(input.label !== undefined ? { label: input.label || null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  }
  if (Object.keys(data).length > 0) await db.aiProviderKey.update({ where: { id: keyId }, data })
  invalidateAiProviders()
  await audit(session, "UPDATE", providerId, { key: `…${k.last4}`, ...input })
}

export async function deleteAiKey(session: Session, providerId: string, keyId: string) {
  const k = await getKey(providerId, keyId)
  await db.aiProviderKey.delete({ where: { id: keyId } })
  invalidateAiProviders()
  await audit(session, "UPDATE", providerId, { keyRemoved: `…${k.last4}` })
}

/** One short request on this key alone. Records the outcome on the key, like a real task does. */
export async function testAiProviderKey(providerId: string, keyId: string): Promise<AiKeyTest> {
  await getKey(providerId, keyId)
  // Fresh rows, so a key added a moment ago on another server is tested too.
  invalidateAiProviders()
  const provider = (await loadAiProviders()).find((p) => p.id === providerId)
  if (!provider || !isAiKind(provider.kind)) throw new NotFoundError("AI provider")
  if (!provider.keys.some((k) => k.id === keyId)) {
    return {
      ok: false,
      model: null,
      ms: 0,
      error: "This key can't be read. Remove it and add it again.",
    }
  }
  return testAiKey(provider, keyId)
}
