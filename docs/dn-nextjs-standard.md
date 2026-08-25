# DN Next.js Project Standard

> **For AI assistants (Claude Code, Cursor, Copilot, Codex):** this is the source of truth for how
> every Next.js project at Digitally Next is structured. Follow it exactly. Do not invent
> alternative structures. For existing code that disagrees, follow this file for **new** code and
> leave the old code alone unless asked to migrate it.
>
> **Activate in a project:** copy this file to the repo root as `CLAUDE.md` and `AGENTS.md`.

---

## 1. Stack — fixed

Next.js 16 (App Router) · React 19 · TypeScript strict · PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
· Auth.js v5 (`next-auth`, JWT sessions) · TanStack Query 5 · Zustand 5 (UI state only) · Zod 4 ·
Tailwind 4 + shadcn/ui + lucide-react + sonner · react-hook-form · nodemailer · pnpm · Node 24.

Pin exactly: `"next-auth": "5.0.0-beta.31"` (no stable v5 exists) and
`"packageManager": "pnpm@10.12.1"` (a range is invalid here).

**No Server Actions.** No `"use server"`, no `*.actions.ts`. All mutations are API routes called by
TanStack Query hooks — one transport, one error shape, one auth path.

---

## 2. Folder structure — compulsory

**No `src/`.** Everything at the repo root, `@/*` → `./*`. `app/` is routing only; logic lives in
`features/`.

```
app/
  (marketing)/                 public pages
  (auth)/                      login, forgot-password
  (app)/                       the authenticated product — always named "(app)"
    layout.tsx                 shell + session gate (NO db queries)
    <section>/
      layout.tsx               2 lines: export const metadata + return children
      page.tsx                 "use client", composes feature components
      loading.tsx              REQUIRED — skeleton mirroring the page
      error.tsx                section root only, never on [id] pages
      [id]/page.tsx            detail page + its own layout.tsx + loading.tsx
  (portal)/                    optional second user population (clients/vendors)
  api/
    <resource>/route.ts        GET list · POST create
    <resource>/[id]/route.ts   GET · PATCH · DELETE (only the verbs the feature needs)
    <resource>/[id]/<verb>/route.ts   workflow actions (approve, send, deactivate)
    cron/<job>/route.ts        external scheduler entry points
    public/…                   unauthenticated, API-key + rate-limited
    health/route.ts            { ok, db, version }
  layout.tsx  error.tsx  global-error.tsx  not-found.tsx  loading.tsx
  globals.css  robots.ts  sitemap.ts

features/<feature>/            one folder per domain — see §4
components/
  ui/                          shadcn primitives
  shared/                      cross-feature widgets (data-table, page-header, status-badge…)
  layout/                      sidebar, topbar, mobile-tabbar
  providers/                   query-provider, theme-provider
lib/                           errors · api-response · api-fetch · pagination · constants ·
                               permissions · audit · notifications · queue · mailer · storage ·
                               rate-limit · api-key · crypto · dates · utils · env · logger ·
                               export-csv · query-server · query/mutation-with-toast
server/                        db · auth · api-handler · action-result · action-guard ·
                               cron-auth · app-config · scheduler · selects
hooks/                         shared client hooks (use-debounce, use-url-state, use-row-selection)
stores/                        zustand — UI state ONLY, never server data
config/                        site.ts · nav.ts
types/                         index.ts · next-auth.d.ts (session augmentation — required)
prisma/                        schema.prisma · migrations/ · seed.ts · sync-permissions.ts
scripts/                       one-off tsx maintenance scripts
docs/                          cron-jobs.md · deployment.md
e2e/                           playwright specs
public/

proxy.ts                       Next 16 middleware (renamed) — auth fence + page RBAC
instrumentation.ts             boot: validate env, warm config, start schedulers
prisma.config.ts               Prisma 7: schema path, migrations, seed cmd, datasource url
vitest.config.ts  playwright.config.ts  eslint.config.mjs  .prettierrc
tsconfig.json  next.config.mjs  components.json
.nvmrc  .env.example  .editorconfig  .github/workflows/ci.yml
```

---

## 3. File naming — one rule each

| Thing             | Rule                                                                                    | Example                                 |
| ----------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| Every file        | `kebab-case`                                                                            | `invoice-form-dialog.tsx`               |
| Component         | one `PascalCase` named export per file                                                  | `export function InvoiceTable()`        |
| Feature folder    | plural noun                                                                             | `features/invoices/`                    |
| Service           | `<feature>.service.ts` — same word as the folder (plural)                               | `invoices.service.ts`                   |
| Queries           | `<feature>.queries.ts` — **only** if a prefetch page needs it                           | `invoices.queries.ts`                   |
| Job               | `<topic>.service.ts` — jobs are services                                                | `invoice-reminders.service.ts`          |
| Guard / IO client | plain `<topic>.ts`, no suffix                                                           | `project-access.ts`                     |
| Zod schema        | `schemas/<singular>.schema.ts` → `createXSchema`, `CreateXInput`                        | `invoice.schema.ts`                     |
| Hook              | `hooks/use-<feature>.ts`; a second file only for a sub-resource with its own API prefix | `use-invoices.ts`                       |
| Feature email     | `emails/<name>.ts` → `render<Name>Email()`                                              | `emails/invoice-reminder.ts`            |
| Permission scope  | `<entity>:<verb>` — the module is the entity, never a department                        | `invoice:approve` not `finance:approve` |
| Status maps       | `<X>_STATUS_LABELS` + `<X>_STATUS_COLORS` in `lib/constants.ts`                         | `INVOICE_STATUS_COLORS`                 |
| Query key         | flat array, kebab noun first                                                            | `["invoices", filters]`                 |
| Env var           | `SCREAMING_SNAKE`; browser-visible → `NEXT_PUBLIC_`                                     | `AUTH_SECRET`                           |
| Log tag           | `[SCREAMING_CONTEXT]`                                                                   | `console.error("[INVOICES]", err)`      |
| Migration         | `<yyyymmddHHMMSS>_<snake_case>/migration.sql`                                           | `20260825000000_invoices`               |
| Test              | colocated `<file>.test.ts`; e2e in `e2e/<flow>.spec.ts`                                 | `invoices.service.test.ts`              |

---

## 4. Feature anatomy

```
features/<feature>/
  index.ts                        ALWAYS — the public API. Named exports. NEVER server/ or emails/.
  components/                     ALWAYS — export from the barrel only what a page or another
                                  feature imports; single-use helpers stay private.
  hooks/use-<feature>.ts          ALWAYS (any feature with data). One file, in this order:
                                    1. exported wire types  2. private fetchers
                                    3. query hooks          4. mutation hooks
  server/<feature>.service.ts     ALWAYS — reads AND writes; every export returns ActionResult
  server/<feature>.queries.ts     only when a §7 prefetch page exists
  server/<topic>.ts               guards / IO clients / device clients
  schemas/<singular>.schema.ts    ALWAYS for any write
  emails/  lib/  <feature>.ts     optional: feature emails · client-safe helpers · client-safe registry
```

**Not in a feature:** `types.ts` (wire types live in the hook file, input types are `z.infer`) and
`constants.ts` (unless the feature owns 5+ of its own). App-wide constants go in `lib/constants.ts`.

**Barrel rule:**

- Client code imports another feature only through `@/features/<x>`.
- Server code imports server modules **by path**: `@/features/<x>/server/<file>`.
- Inside a feature use absolute `@/features/<own>/…`, not `../`.
- Named exports only — never `export *` (two `export *` lines collide silently).

---

## 5. The request pipeline

```
page → feature component → hook (TanStack Query + apiFetch)
     → app/api/<resource>/route.ts → features/<f>/server/<f>.service.ts → server/db.ts
```

**Route** — one expression. No `try/catch`, no `db`, no business logic, no `NextResponse.json`.

```ts
export const GET = withErrorHandler(async (req) =>
  respond(await listInvoices({ q: req.nextUrl.searchParams.get("q") })),
)
export const POST = withErrorHandler(async (req) =>
  respond(await createInvoice(await req.json()), 201),
)

// Dynamic routes MUST pass the param type or `params.id` is `string | undefined`
// under noUncheckedIndexedAccess and the build fails:
export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await updateInvoice(params.id, await req.json())),
)
```

Use `withErrorHandler` + guards inside the service by default. Use `withAuth(scope, …)` /
`withSession(…)` only when the route itself needs `session`. Streaming routes (SSE, file downloads)
are the one exemption from `respond()` — they still use a wrapper for auth.

**Service** — the shape every one of them follows:

```ts
import "server-only"

export async function createInvoice(raw: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.INVOICE_WRITE)
    const input = createInvoiceSchema.parse(raw) // ZodError → 422 automatically
    if (await exists(input)) return fail("Already exists", undefined, 409) // return, never throw
    const row = await db.invoice.create({ data: input, select: INVOICE_SELECT })
    await createAuditLog(session, {
      action: "invoice:create",
      module: "invoice",
      entityId: row.id,
      ...(await getAuditMeta()),
    })
    return ok(serialize(row))
  })
}
```

**Workflow transitions** are `POST /api/<resource>/[id]/<verb>` with an atomic claim — never
`PATCH { status }`, never read-then-write:

```ts
const claimed = await db.invoice.updateMany({
  where: { id, status: "SENT" },
  data: { status: "PAID" },
})
if (claimed.count === 0) return fail("Invoice is not awaiting approval", undefined, 409)
```

**Jobs** (cron/scheduler) are services that skip `requireSession` (auth is `assertCron` at the
route), return `ActionResult<{ processed: number }>`, take a capped batch, wrap each row in
`try/catch`, and audit with `createAuditLog(null, …)` as the system actor.

**Wire envelope** — `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.
A paginated read is `ok({ data: rows, pagination })`, so hooks read `.data.data` for lists and
`.data` for one object. Money is `Decimal(12,2)` in Postgres and a **string** on the wire.

**Hooks** — lists use `placeholderData: keepPreviousData` and `staleTime: 30_000` (60_000 lookups,
300_000 near-static). Every mutation goes through `mutationWithToast` and lists the keys it
invalidates.

---

## 6. Rules by area

**Formatting** — no semicolons, double quotes, width 100, trailing commas, `prettier-plugin-tailwindcss`.
ESLint 10 flat config: import `eslint-config-next/core-web-vitals` and `/typescript` directly
(never through `FlatCompat` — it crashes), pin `settings.react.version`, keep `prettier` last,
allow `^_` unused vars. `next.config.mjs` must **not** set `typescript.ignoreBuildErrors`.

**TypeScript** — `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`. `types/next-auth.d.ts`
must augment `Session.user` with `id`, `kind`, `roles`, `permissions`, `mustChangePassword` or every
permission check fails to compile.

**Zod 4** — `z.email()`, `z.url()`, `z.flattenError(err)`. The v3 forms (`z.string().email()`,
`err.flatten()`) are deprecated. The same schema validates the form (`zodResolver`) and the service.

**Database** — `@map`/`@@map` to snake_case; every model has uuid `id`, `createdAt`,
`updatedAt @updatedAt`; index every FK and every column used in a list `where`/`orderBy`; partial
unique indexes are written in raw SQL. **Migrations are hand-written SQL applied with
`prisma migrate deploy`** — `migrate dev` needs shadow-DB rights hosted Postgres usually refuses:

1. edit `schema.prisma`
2. write `prisma/migrations/<stamp>_<name>/migration.sql` with `IF NOT EXISTS` guards
3. `pnpm db:migrate` → 4. `pnpm db:generate` → 5. verify against `information_schema` in a tsx script

`prisma.config.ts` (not `package.json`) holds the seed command and the datasource URL in Prisma 7.
`db:seed` is destructive — never on a live database; permission changes ship via
`pnpm db:sync-permissions`.

**Auth & permissions** — permissions ride the JWT (zero DB reads per request); a role change takes
effect on the next `session.update()` or re-login. Adding a scope touches five places in one commit:
`PERMISSIONS` → `PERMISSION_DEFINITIONS` → `pnpm db:sync-permissions` → `proxy.ts` ROUTE_RULES →
`config/nav.ts`. Hiding a nav item is cosmetic; `proxy.ts` and the service guard are the enforcement.

**Second population (portal)** — one Auth.js instance, a second Credentials provider,
`session.user.kind` discriminates, `proxy.ts` fences `/portal*` + `/api/portal*` both ways, mirror
guards (`withClientSession`, `requireClientSession`). External-user grants are read from the **DB per
request**, never cached in the JWT, and a missing grant answers **404, not 403** so a client cannot
probe what exists.

**Background work** — one question: _does a double or missed run cost something?_
Yes (customer emails, accruals, billing, anything date-bound) → `app/api/cron/<job>/route.ts` +
`assertCron`, scheduled by an external crontab documented in `docs/cron-jobs.md`.
No, and it must run continuously (queue draining, probes) → `server/scheduler.ts` interval started
from `instrumentation.ts`, timer on `globalThis`, `unref()`, a running flag so ticks never overlap.
Only one instance runs the inline scheduler — `DISABLE_INLINE_SCHEDULER=1` on the others.

**Pages** — default is a `"use client"` page composing feature components. `loading.tsx` is required
beside every page; `error.tsx` only at a section root. The server-prefetch pattern (server
`page.tsx` + `<x>-client.tsx` + `HydrationBoundary`) is for the 3–5 heaviest list pages only, and its
query key must equal the client hook's key byte-for-byte; wrap the prefetch in `try/catch` — never
500 a page over a prefetch. List state (page, filters, tab) lives in the URL via `useUrlState`.
Every list uses `DataTable` with `rowKey`, `pagination`, `loading`, and either a `mobileCard` or
`mobileCard={false}`.

**Security** — `import "server-only"` on every `server/*` and `features/*/server/*` file (except
`server/db.ts`, which tsx scripts import). Secrets deny-by-default in the Prisma `omit`, opted back
in only where verified. Constant-time compares for shared secrets; secret-gated endpoints fail
closed when the env var is unset. Rate-limit every public endpoint. Audit-log every mutation.
Generate object keys server-side, store the key not the signed URL, mint signatures per read.
Use `Date.UTC` for quotas and bounds — `new Date(y, m, 1)` is local midnight and shifts by timezone.
`lib/env.ts` validates the environment with Zod and is imported by `instrumentation.ts` so boot
fails, not the first request.

**Testing** — Vitest colocated (`<file>.test.ts`), node environment by default, `server-only` and
`next/headers` mocked; `"test": "vitest run --passWithNoTests"` so a fresh repo passes. Minimum: a
parse test per schema, a test per service write path with `vi.mock("@/server/db")`. Playwright in
`e2e/` covers login + one list + one create flow.

---

## 7. Things to avoid

| Don't                                       | Because                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `db` or business logic in `app/`            | A route can't be prefetched by a server page or reused by a job     |
| Export `server/` or `emails/` from a barrel | A client import pulls `server-only` into the bundle; build fails    |
| `export *` in a barrel                      | Collisions between two `export *` lines are silent                  |
| Server Actions / `"use server"`             | Two transports = two error shapes and two auth paths                |
| `try/catch` in a route handler              | The wrapper owns error mapping; a local catch hides the envelope    |
| Throw for an expected failure               | Next redacts thrown messages in production — `return fail(…)`       |
| Unbounded `findMany`                        | One endpoint reading a whole table stalls the app via the pool      |
| `include` on list queries                   | Ships every column of every row — use `select`                      |
| Read-then-write for a status change         | Two approvers both succeed — use the atomic `updateMany` claim      |
| Store a signed URL                          | Signatures expire (7-day cap); the link dies while the row lives    |
| `process.env` for admin-changeable values   | Admins can't restart the server — use `getConfig()`                 |
| `prisma migrate dev` on a hosted DB         | Needs shadow-DB rights most hosts refuse (P3014)                    |
| `db:seed` on a live database                | It is destructive — `db:sync-permissions` is the safe path          |
| `typescript.ignoreBuildErrors: true`        | A broken import becomes a runtime 500 instead of a failed build     |
| `components/` importing `@/features/*`      | Inverts the dependency graph                                        |
| `PATCH { status }` for a workflow           | Each transition needs its own guard and its own atomic claim        |
| A department name as a permission module    | Scopes are `<entity>:<verb>` — `invoice:approve`, not `finance:*`   |
| Local-time date math for quotas             | Servers run UTC; local midnight shifts the window                   |
| `console.log` in app code                   | Use `console.error("[TAG]", err)`; scheduler logs are the exception |
| Ad-hoc colours / multiple radii             | Use the design tokens and `TONE` maps via `StatusBadge`             |

---

## 8. Checklists

**Add a feature (`invoices`) — the exact files:**

```
features/invoices/index.ts
features/invoices/schemas/invoice.schema.ts
features/invoices/server/invoices.service.ts
features/invoices/hooks/use-invoices.ts
features/invoices/components/invoice-table.tsx
features/invoices/components/invoice-form-dialog.tsx
app/api/invoices/route.ts
app/api/invoices/[id]/route.ts
app/(app)/invoices/{layout,page,loading,error}.tsx
prisma/schema.prisma + prisma/migrations/<stamp>_invoices/migration.sql
lib/constants.ts        (scopes + PERMISSION_DEFINITIONS + status maps)
config/nav.ts · proxy.ts
features/invoices/{server/invoices.service.test.ts,schemas/invoice.schema.test.ts}
```

Add per need: `[id]/<verb>/route.ts` per workflow action · `emails/<name>.ts` + a cron route for
reminders · `invoices.queries.ts` + `invoices-client.tsx` only for the prefetch pattern ·
`[id]/{page,layout,loading}.tsx` for a detail view.

Order: schema + migration → constants → zod schema → service → routes → hook → components → barrel
→ pages → nav + proxy → tests → `pnpm db:sync-permissions` → `pnpm validate`.

**Add an endpoint:** service function → route (one expression) → fetcher + hook + invalidations →
if a non-browser caller: put it under `/api/public/` or `/api/cron/` with the matching guard.

**Add a permission:** `PERMISSIONS` + `PERMISSION_DEFINITIONS` → `pnpm db:sync-permissions` →
`proxy.ts` ROUTE_RULES → `config/nav.ts` → `requirePermission` in the service.

**Add a setting:** a field in `settings.registry.ts` → read with `getConfig()` → add the env
fallback to `.env.example`.

**Promote a shared component:** only when a second feature needs it — move to `components/shared/`,
delete the local copy, update both imports.

---

## 9. Done means

`pnpm validate` and `pnpm build` green · `.env.example` updated for any new var · new scopes synced
and reflected in proxy + nav · migration hand-written, deployed and verified · every list paginated
or capped · every mutation audit-logged · `loading.tsx` beside every new page · tests per §6 · no
`console.log`, no `TODO` without an issue · Conventional Commit (`feat:`, `fix:`, `chore:`,
`refactor:`, `docs:`, `test:`).
