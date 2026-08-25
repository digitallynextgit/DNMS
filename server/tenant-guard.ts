import "server-only"

import { Prisma } from "@prisma/client"
import { currentTenant, unscopedReason, type TenantContext } from "@/server/tenant-context"

// =============================================================================
// The tenant guard (M4) - a Prisma extension that scopes every query.
//
// M1 gave every row a tenant. M2 gave every session one. M3 put it in the URL.
// None of that stops a query reading another company's rows; this does.
//
// For each of the 106 tenant-scoped models it:
//   - adds `tenantId` to the WHERE of every read, update and delete
//   - stamps `tenantId` onto every create
//
// The model list comes from Prisma's DMMF at runtime, not a hand-kept array, so
// a new model with a tenant_id column is covered the moment it is generated and
// one without it can never be silently mis-listed.
//
// ── WHAT THIS DOES NOT COVER ─────────────────────────────────────────────────
// Say it plainly, because a guard you over-trust is worse than none:
//
//   1. `$queryRaw` / `$executeRaw` pass straight through. Prisma extensions do
//      not see them. Row-level security is the only thing that would, and it is
//      not in place - see docs/multi-tenancy-progress.md for why.
//   2. NESTED writes (`create: { data: { …, tasks: { create: [...] } } }`) are
//      not stamped: the extension rewrites the top-level `data`, not the tree
//      beneath it. The database DEFAULT still catches those, which is one of the
//      reasons the default has not been dropped.
//   3. It scopes by tenant, not by user. Who inside a company may see what is
//      still the permission system's job.
//
// ── MODES ────────────────────────────────────────────────────────────────────
// `TENANT_ENFORCEMENT`:
//   off     - extension does nothing. An escape hatch, not a setting to leave on.
//   warn    - (default) scope when there is a context; log loudly when a scoped
//             model is queried without one. Correct today, because there is one
//             tenant and every row belongs to it.
//   strict  - throw instead of logging. Turn this on BEFORE onboarding the
//             second company: in `warn` an unscoped query silently reads
//             everything, which is exactly the leak this exists to prevent.
// =============================================================================

type Mode = "off" | "warn" | "strict"

function readMode(): Mode {
  const raw = process.env.TENANT_ENFORCEMENT?.toLowerCase()
  if (raw === "off" || raw === "strict" || raw === "warn") return raw
  return "warn"
}

const MODE: Mode = readMode()

/** Model names carrying a `tenantId`, straight from the generated schema. */
const TENANT_SCOPED: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId"))
    .map((m) => m.name),
)

/**
 * Every operation whose `where` selects existing rows - reads and mutations
 * alike. All of them simply get `tenantId` merged in.
 *
 * `findUnique` and `findUniqueOrThrow` are in here too, which is worth knowing:
 * Prisma normally restricts their `where` to unique fields, but
 * `extendedWhereUnique` (GA since Prisma 5) allows extra non-unique filters
 * alongside the unique one. Verified against this database - a findUnique by id
 * with the wrong tenant returns null, and an update with the wrong tenant
 * raises "no record was found". So there is no need to rewrite them into
 * findFirst, and Prisma's findUnique batching is preserved.
 *
 * This matters more than the other operations: `findUnique({ where: { id } })`
 * with an id off the URL is the realistic way one company reads another's row.
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

/** Mutations that bring new rows into being. */
const STAMPED_WRITES = new Set(["create", "createMany", "createManyAndReturn"])

/**
 * The tenant for a SERVER COMPONENT render, read from the request headers.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `getSession()` establishes the ambient context for API routes and server
 * actions, which covers both of those families in one line. Server components
 * reach neither: a page renders outside every wrapper. Having the LAYOUT enter
 * the context does not help either - React renders a page in its own async
 * task, not a descendant of the layout's, so the store set there is invisible.
 * Measured, not assumed: with the layout entering context, 21 queries from page
 * renders still arrived with none.
 *
 * That left two options: call an accessor at the top of every page and every
 * query module they reach (dozens of places, each one forgettable), or read the
 * answer the proxy already worked out. This is the second.
 *
 * `x-tenant-id` is written by proxy.ts AFTER checking the URL against the
 * session, and deleted from every inbound request, so it cannot be forged.
 *
 * Returns null outside a request entirely - a cron tick, a CLI script - where
 * `headers()` throws. Those have their own context (forEachTenant, runUnscoped).
 */
async function tenantFromRequestHeaders(): Promise<TenantContext | null> {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const tenantId = h.get("x-tenant-id")
    if (!tenantId) return null
    return { tenantId, slug: h.get("x-tenant-slug") ?? "" }
  } catch {
    // No request scope. Not an error - see above.
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

/** Merge a tenant filter into a `where`, leaving whatever was there intact. */
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
    // Spread AFTER tenantId so an explicit value in the payload still wins -
    // seeding and the platform console legitimately create rows for a named
    // tenant while running inside another (or none).
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

          // Deliberately cross-tenant: signing in, the platform console, a cron
          // loop deciding which tenants to visit.
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

          // `query` is typed for one specific operation, but this callback sees
          // all of them at once, so the narrowed args are handed back through a
          // cast. The shapes are checked by the runtime, and by
          // scripts/verify-tenant-guard.ts, which drives every operation for real.
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

/** For diagnostics and the verification script. */
export const TENANT_GUARD_INFO = {
  mode: MODE,
  scopedModelCount: TENANT_SCOPED.size,
  scopedModels: TENANT_SCOPED,
}
