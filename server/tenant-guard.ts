import "server-only"

import { Prisma } from "@prisma/client"
import { currentTenant, unscopedReason, type TenantContext } from "@/server/tenant-context"

// Prisma extension that adds `tenantId` to the WHERE of every read/update/delete on a
// tenant-scoped model and stamps it onto every create.
// NOT covered: $queryRaw / $executeRaw, and nested writes (the DB default catches those).
// TENANT_ENFORCEMENT: off | warn (log unscoped queries) | strict (throw).

type Mode = "off" | "warn" | "strict"

function readMode(): Mode {
  const raw = process.env.TENANT_ENFORCEMENT?.toLowerCase()
  if (raw === "off" || raw === "strict" || raw === "warn") return raw
  // Unset: fail closed in production rather than silently read every tenant's rows.
  return process.env.NODE_ENV === "production" ? "strict" : "warn"
}

const MODE: Mode = readMode()

// From the generated schema, so a new model with tenantId is covered automatically.
const TENANT_SCOPED: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId"))
    .map((m) => m.name),
)

/**
 * Operations whose `where` gets `tenantId` merged in. findUnique works too: Prisma 5+ allows
 * extra non-unique filters there, so a wrong-tenant id returns null.
 */
const FILTERED = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
])

const STAMPED_WRITES = new Set(["create", "createMany", "createManyAndReturn"])

/**
 * Fallback for server components, which render outside any ambient context (even their layout's).
 * Safe to trust: proxy.ts strips `x-tenant-id` from every inbound request and sets it only after
 * checking the session. Null outside a request (cron, scripts), where headers() throws.
 */
async function tenantFromRequestHeaders(): Promise<TenantContext | null> {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const tenantId = h.get("x-tenant-id")
    if (!tenantId) return null
    return { tenantId, slug: h.get("x-tenant-slug") ?? "" }
  } catch {
    // No request scope.
    return null
  }
}

const warned = new Set<string>()

function reportMissingContext(model: string, operation: string): void {
  const key = `${model}.${operation}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(
    `[TENANT] ${key} ran with no tenant context - it read or wrote across every tenant. ` +
      `Wrap the caller in runWithTenant(), or in runUnscoped() if that is deliberate.`,
  )
}

type Args = Record<string, unknown>

function narrow(where: unknown, tenantId: string): Args {
  if (where && typeof where === "object") {
    return { ...(where as Args), tenantId }
  }
  return { tenantId }
}

function stamp(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) =>
      row && typeof row === "object" ? { tenantId, ...(row as Args) } : row,
    )
  }
  if (data && typeof data === "object") {
    // An explicit tenantId in the payload wins (seeding, platform console).
    return { tenantId, ...(data as Args) }
  }
  return data
}

export const tenantGuard = Prisma.defineExtension((client) =>
  client.$extends({
    name: "tenant-guard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (MODE === "off") return query(args)
          if (!TENANT_SCOPED.has(model)) return query(args)

          if (unscopedReason() !== null) return query(args)

          const tenant = currentTenant() ?? (await tenantFromRequestHeaders())
          if (!tenant) {
            if (MODE === "strict") {
              throw new Error(
                `[TENANT] refusing ${model}.${operation} with no tenant context. ` +
                  `Enter one with runWithTenant(), or declare the intent with runUnscoped().`,
              )
            }
            reportMissingContext(model, operation)
            return query(args)
          }

          const id = tenant.tenantId
          const a = (args ?? {}) as Args

          // `query` is typed for one operation but this sees all of them, hence the cast.
          const run = query as (a: unknown) => Promise<unknown>

          if (FILTERED.has(operation)) {
            return run({ ...a, where: narrow(a.where, id) })
          }

          if (STAMPED_WRITES.has(operation)) {
            return run({ ...a, data: stamp(a.data, id) })
          }

          if (operation === "upsert") {
            return run({
              ...a,
              where: narrow(a.where, id),
              create: stamp(a.create, id),
            })
          }

          return query(args)
        },
      },
    },
  }),
)

/** For diagnostics. */
export const TENANT_GUARD_INFO = {
  mode: MODE,
  scopedModelCount: TENANT_SCOPED.size,
  scopedModels: TENANT_SCOPED,
}
