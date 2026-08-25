# Multi-tenancy — build progress

Design: the _DNMS Multi-Tenant Design_ artifact (path-scoped pages, token-scoped APIs, one login).
This file tracks what is actually built. **Update it at the end of every milestone.**

## Ground rule

The deployed VPS runs a build that predates tenancy. Every migration must leave it working. That is
why `tenant_id` is `NOT NULL` **with a DEFAULT** of the founding tenant: an INSERT from the old code,
which never mentions the column, still succeeds and lands in the right tenant. The default comes off
in a later cleanup pass, once every write path sets the tenant explicitly and the new build is live.

## Founding tenant

|               |                                        |
| ------------- | -------------------------------------- |
| id            | `0197d1ab-0000-7000-8000-000000000001` |
| slug          | `digitallynext`                        |
| name          | Digitally Next                         |
| plan / status | `ENTERPRISE` / `ACTIVE`                |

The id is hard-coded (not random) so the schema default, the migration and any script agree. It
lives in `server/tenant-context.ts` as `FOUNDING_TENANT_ID`.

## M1 — Tenant spine ✅ done 25 Aug 2026

- `Tenant` model + `tenants` table; Digitally Next inserted.
- `tenant_id` added to **105** of 114 models — `NOT NULL`, `DEFAULT` founding, indexed, FK to
  `tenants(id)` `ON DELETE RESTRICT`.
- Platform models deliberately left global (9): `Account`, `Session`, `VerificationToken`,
  `Permission`, `PasswordReset`, `NewsletterSubscriber`, `ProjectPhase`, `AppSetting`,
  `StorageAccount`. `AppSetting` splits into platform/tenant settings in M4; `StorageAccount` is
  decided then too.
- In Prisma the column is a plain scalar with `@default(dbgenerated(...))`, **not** a relation:
  the default is what keeps the deployed build alive, and 105 relations would put 105 back-relation
  fields on `Tenant` for no query benefit. The FK is real, in the database.
- `server/tenant-context.ts` — `runWithTenant`, `currentTenant`, `requireTenantId` (throws), and the
  transitional `currentTenantIdOrFounding()` (warns once, falls back; **delete in M4**).
- `server/tenants.ts` — lookup by slug/id, `RESERVED_SLUGS`, `SLUG_PATTERN`, `isServable`.

Verified by `npx tsx prisma/verify-tenancy.ts` (re-run 26 Aug 2026): 15,062 rows across 74 populated
tables intact · 105/105 columns NOT NULL + DEFAULT + indexed + FK · zero unattributed rows · an
old-code INSERT without `tenant_id` succeeds and resolves to `digitallynext` (run in a rolled-back
transaction) · `tsc`, `eslint`, `prettier`, `next build` all clean.

Migration: `prisma/migrations/20260825000000_tenant_spine/`.

## M2 — Identity ✅ done 26 Aug 2026

**Collision report first.** `npx tsx prisma/report-email-collisions.ts` — 17 employees, 1 client
user, **zero** shared addresses and no case-only duplicates. So the merge rule that needed a human
call (staff hash wins, client credential invalidated) never had to be applied. The report stays in
the repo; the M2 migration re-runs the same check as an assertion and aborts if one ever appears.

**Schema.** `users` (one row per human, keyed by lower-cased email, holds the credential) and
`memberships` (userId × tenantId × kind → the profile row). Two guarantees live in the database,
not in TypeScript:

- a CHECK constraint — `kind = STAFF` implies exactly `employee_id`, `kind = CLIENT` exactly
  `client_user_id`;
- **composite** foreign keys `(employee_id, tenant_id) → employees(id, tenant_id)` and the same for
  `client_users`, so a membership in tenant A pointing at a profile row in tenant B cannot be
  inserted. Prisma models the relation single-column; the composite FK is migration-only.

`password_resets` gained `user_id` (NOT NULL, backfilled) and `employee_id` became nullable.

**Additive only.** `employees.password_hash` and `client_users.password_hash` are still there and
still written. The deployed build authenticates against them, so `setPassword()` in
`server/identity.ts` writes the platform credential AND the legacy column in one transaction. It is
the only function permitted to write a hash — all 7 former call sites now go through it. Both
columns are dropped in M4.

**Auth.** Sign-in is now two steps: prove who you are (`users`, by email + password), then pick what
you are (`memberships`). `token.id` / `session.user.id` is deliberately **unchanged** — still the
employee id for staff, the client_user id for a client — because several hundred queries key off it.
The platform id rides alongside as `session.user.userId`, with `membershipId`, `tenantId` and
`tenantSlug`.

- One login point: `/login` serves both populations. `/client-login` still works and differs only in
  preferring a CLIENT membership for someone who holds both.
- 15-minute membership re-check in the JWT callback. Revoking a role, deactivating someone or
  suspending a tenant now takes effect within 15 minutes instead of at token expiry; a membership
  that has gone away ends the session.
- `adoptLegacyLogin()` closes the deploy window: an account created by the still-deployed pre-M2
  build has no `users` row, so it is adopted on first sign-in against the same legacy hash. Delete
  in M4.

Verified: `prisma/verify-identity.ts` — 18 users, 17 STAFF + 1 CLIENT membership, hashes
byte-identical to the legacy columns, malformed and cross-tenant memberships rejected by the
database (with a control case proving the constraint is not simply rejecting everything).
`prisma/verify-login-parity.ts` — **every one of the 15 active employees and the 1 client gets a
byte-identical session** from the new path; 2 deactivated employees stay locked out; the Google-only
account (no password hash) still resolves; a client signing in at `/login` resolves as a client.
`tsc`, `eslint`, `prettier`, `next build` clean.

Migration: `prisma/migrations/20260826000000_identity_users_memberships/`.

## M3 — URL space ✅ done 26 Aug 2026

`dnms.digitallynext.com/{tenant}/dashboard`. **No database change** — M3 is code only.

**Pages are path-scoped, APIs are token-scoped.** `/api/...` never carries a prefix: an API caller
(the mobile app, a webhook) proves its tenant with its credential, not with a URL segment.

**No `app/[tenant]/` folder.** The proxy REWRITES `/{tenant}/projects` to `/projects`, so the route
tree is untouched and un-prefixed URLs keep working on their own. Moving 23 route folders into a
dynamic segment would have changed every page signature for no behaviour the rewrite does not
already give — and would have been the single most dangerous thing to do to a live deployment.

- `lib/tenant-url.ts` — the whole URL grammar as pure functions, no framework imports, so the Edge
  proxy, the browser and Node all share one definition. `TENANT_SCOPED_SEGMENTS` is an ALLOW-list;
  `server/tenants.ts` now derives `RESERVED_SLUGS` from it, so a route can never become claimable
  by omission.
- `proxy.ts` — the only place a slug in a URL becomes a fact. Checks the claim against
  `session.user.tenantSlug` (a string compare, no database: that is why M2 put the slug in the
  token), rewrites, and writes `x-tenant-slug`. It DELETES any inbound value of that header on every
  request, so what downstream reads was written here.
- `server/tenant-request.ts` — `currentTenantSlug()` / `tenantPath()` for server components and
  `redirect()` targets.
- `components/tenant-link.tsx` — a `<Link>` that prefixes at render time. Converting 40 imports
  covered ~120 hrefs, many of them built at runtime; a per-href `tenantPath()` call would have been
  both larger and forgettable. The slug comes from a `TenantProvider` in the layout, NOT from
  `usePathname()` — the proxy rewrites internally, so the server would have rendered `/projects`
  while the browser showed `/digitallynext/projects`: a hydration mismatch on every link.
- `/select-workspace` — switches the active membership via `update({ membershipId })`, which the JWT
  callback re-reads and re-checks against the user. Never shown for a single membership.
- Legacy shim: a signed-in request to an un-prefixed app path is redirected to the canonical
  prefixed URL, so old bookmarks and emailed links migrate themselves.

**Two failures worth recording, both found by running the thing rather than reading it:**

1. **Next re-invokes the proxy on its own rewrite.** `/{tenant}/dashboard` rewrote to `/dashboard`,
   the second pass saw an un-prefixed app path and applied the canonical redirect, which rewrote
   again — a loop that surfaced as a 404. Fixed with the `x-tenant-rewritten` marker on the
   rewritten request; the second pass leaves the path alone. (The marker is also stripped from
   inbound requests — forging it only costs you the cosmetic redirect.)
2. **A streamed `redirect()` is a 200, not a 307.** `/select-workspace` calls `redirect()` after two
   awaits, by which point the shell has flushed, so Next delivers the redirect inside the RSC
   payload. Correct behaviour, and the reason the routing check accepts both shapes.

Verified: `scripts/verify-tenant-urls.ts` — the grammar, plus DRIFT (every folder under
`app/(dashboard)` is declared tenant-scoped) and SAFETY (no route segment is claimable as a slug).
`scripts/verify-tenant-routing.ts` — drives a running server with a minted session: signed-out
redirects keep the prefix in `callbackUrl`; `/{tenant}/dashboard` renders; `/{tenant}` is the front
door; another tenant's URL bounces to the picker and its API 403s; APIs are never prefixed or
redirected; **a forged `x-tenant-slug` changes nothing**; and the rendered shell emits 44 prefixed
links with zero un-prefixed app links left. `tsc`, `eslint`, `next build` clean.

### Two pre-existing bugs the health sweep turned up (fixed 26 Aug 2026)

Neither was caused by tenancy; both had been there a while and were only found because
`scripts/health-check.ts` walks the whole app rather than the parts that changed.

- **`public/favicon.ico` was a PNG.** Byte-identical to `app/icon.png`, magic `89 50 4E 47`, served
  as `image/x-icon`. A bare PNG is not an ICO - the format needs a 6-byte ICONDIR and a 16-byte
  directory entry first - so browsers were left to guess, and the source was 128x112, not square.
  `scripts/build-favicon.ts` now generates a real 16/32/48 ICO from the brand mark.
- **`/robots.txt` and `/sitemap.xml` 307'd to `/login`.** `.txt` and `.xml` are not in `PUBLIC_FILE`
  and were not listed as public prefixes, so `app/robots.ts` and `app/sitemap.ts` were unreachable
  to anyone signed out - i.e. to every crawler. Both are now explicit public prefixes.

## M4 — Enforcement ✅ done 26 Aug 2026

Until M4, the tenant controlled routing but not data: every query still read whatever it always read.

- **`server/tenant-guard.ts`** — a Prisma extension over all **106** tenant-scoped models (the list
  comes from Prisma's DMMF at runtime, so it cannot drift from the schema). It adds `tenantId` to the
  WHERE of every read, update and delete, and stamps it onto every create.
  - `findUnique` is filtered too, which matters most: `findUnique({ where: { id } })` with an id off
    the URL is the realistic way one company reads another's row. Prisma's `extendedWhereUnique`
    accepts the extra filter, verified against this database, so no rewrite to `findFirst` is needed.
  - `TENANT_ENFORCEMENT=off|warn|strict`. Default `warn`. **The whole app passes in `strict`** —
    turn it on before onboarding the second company.
- **Context entry.** `getSession()` in `server/api-handler.ts` covers API routes _and_ server
  actions in one line (`requireSession()` goes through it).
- **Server components** reach neither, and — measured, not assumed — a context entered in the
  LAYOUT does not reach the page: React renders a page in its own async task, and 21 queries still
  arrived unscoped. So the guard falls back to `x-tenant-id`, written by proxy.ts after it checks
  the URL against the session and stripped from every inbound request. One place, unforgettable.
- **`runUnscoped(reason, fn)`** is the only way out, and every use states why: sign-in (which
  companies does this person belong to?), the platform console, cron loops, maintenance scripts.
- **Cron runs per tenant.** All **13** cron routes via `withCron()`, and all **5** in-process
  scheduler ticks via `forEachTenant()`. Before this each swept whole tables in one pass — harmless
  with one customer, and with two it would have mailed Acme's reminders to Digitally Next's staff.
- **Per-tenant device secrets.** `tenants.hook_secret`; the attendance hook resolves the tenant from
  the secret the terminal presents. One platform-wide `ATTENDANCE_HOOK_SECRET` meant any customer's
  door reader could write punches into any other customer's attendance — and attendance is what
  payroll is computed from. The env secret still resolves to Digitally Next so the installed
  terminal keeps working.

Two bugs found by running it rather than reading it:

1. **A lazy Prisma promise escaping its context.** `runUnscoped(r, () => db.x.count())` returned the
   thenable _out_ of the store, so the query executed with the hatch already shut. `getClientForToken`
   used exactly that shape — client sign-in would have silently broken. Both helpers now `await`
   inside the store.
2. **The rewrite had the wrong origin.** Auth.js rebuilds the request from `NEXTAUTH_URL`, so
   `req.url` and `req.nextUrl` inside proxy.ts carried `localhost:3000`. For a redirect that is
   cosmetic; for a **rewrite it is fatal** — Next compares origins, sees a different one, and proxies
   the request out to that host. On the VPS behind nginx it would have round-tripped through the
   public URL. Every redirect and the rewrite now build on the real `Host`.

**RLS is NOT in place**, deliberately. `SET LOCAL` is a no-op outside a transaction, and this app
uses a `pg` Pool with no per-request transaction, so the honest options were "wrap every request in
a transaction" (serialises the app) or "half-apply it" (false confidence). The gap it would close is
named in `tenant-guard.ts`: `$queryRaw` is not intercepted. Designed, not done.

Verified: `scripts/verify-tenant-guard.ts` — reads, `findUnique`-by-id, aggregate, groupBy, creates,
updateMany, deleteMany, inside `$transaction`, and the escape hatch, all in both modes.

## M5 — Front door ✅ done 26 Aug 2026

- **`/signup`** — a company creates itself: `features/tenants/server/provision.service.ts` creates
  the tenant, its **5 roles with grants**, default leave types, the founding admin, their platform
  identity and membership — in one transaction, because a half-provisioned tenant looks like it
  worked and locks somebody out of an account they believe they created. The founder is signed in
  immediately with the password they just chose.
- **`lib/role-catalogue.ts`** — the roles, extracted from `prisma/seed.ts` so provisioning a company
  and seeding a database cannot disagree. They were the same list written twice.
- **`/platform`** — every customer on one page. Gated by `PLATFORM_ADMINS` (an email allow-list)
  **AND** being signed in to the founding tenant; unset means nobody. Returns 404, not 403, to
  anyone else. Read-only for now.
- **`features/tenants/plans.ts`** — the four tiers as data. Priced per employee per month, which is
  the honest unit: what the product does scales with headcount and nothing else. Headcount ceilings
  are enforced at employee creation; trial expiry and suspension were already enforced at sign-in in
  M2 (a lapsed tenant yields no membership, so nobody from it can get in).

### The blocker M5 found

Provisioning a second tenant was **impossible**, and nothing before this had noticed: `roles.name`
was globally unique, so creating Acme's "admin" role collided with Digitally Next's. An audit of all
72 unique constraints on tenant-scoped tables separated the ones already scoped by a UUID in the key
(`(employee_id, date)`, `(project_id, name)` — fine) from the ones keyed on a name a **human** chose:
`roles(name)`, `employees(employee_no)` (both companies start at EMP-2026-0001), `leave_types(code)`,
`departments(name)`, `holidays(date, name)` (both observe Diwali), `projects(slug)`, and five more.
All eleven are now `(tenant_id, …)`.

Left global on purpose: `employees.email` / `client_users.email` (email is the platform login key
since M2), `hikvision_devices.device_serial`, storage object keys, idempotency keys.

Verified: **`scripts/verify-provisioning.ts` creates a real second tenant.** Six malformed signups
refused; 5 roles with the right grant counts; the two companies cannot see each other's employees,
by count, by id, or by email; the founder can sign in and resolves to exactly their own workspace;
the tenant is removed and Digitally Next is byte-for-byte unchanged.

## Before onboarding the second real company

1. Set `TENANT_ENFORCEMENT=strict`. It passes today; leaving it on `warn` means an unscoped query
   reads everything instead of failing.
2. Set `PLATFORM_ADMINS`.
3. Replace the in-process signup throttle in `signup.actions.ts` with something shared and durable.

## After the new build is deployed and confirmed

These are the deletions M1-M4 kept alive on purpose, and **none of them may run before the deploy** —
each one breaks the build currently on the VPS:

- the `tenant_id` DB defaults (they are what let the pre-tenancy build INSERT). Audit nested writes
  first: the Prisma extension stamps top-level `data` only, and the default is what covers the rest.
- `employees.password_hash` / `client_users.password_hash` and the dual-write in `setPassword()`
- `adoptLegacyLogin()`, `currentTenantIdOrFounding()`, `currentTenantSlugOrFounding()`
- the `ATTENDANCE_HOOK_SECRET` fallback, once the office terminal is on a per-tenant secret

## Verification scripts

| Script                              | What it proves                                             |
| ----------------------------------- | ---------------------------------------------------------- |
| `prisma/verify-tenancy.ts`          | M1: columns, FKs, attribution, old-code INSERT works       |
| `prisma/report-email-collisions.ts` | M2 pre-flight: no address is shared across populations     |
| `prisma/verify-identity.ts`         | M2: backfill complete, DB refuses malformed rows           |
| `prisma/verify-login-parity.ts`     | M2: every account's session is unchanged                   |
| `scripts/verify-tenant-urls.ts`     | M3: the URL grammar, route drift, slug safety              |
| `scripts/verify-tenant-routing.ts`  | M3: what the proxy really does (needs a running server)    |
| `scripts/health-check.ts`           | Every page + API, prefixed and legacy, plus the icon chain |

All are read-only (writes run inside rolled-back transactions). Run them before any deploy that
touches tenancy or auth. The prisma ones and `verify-tenant-urls` need
`npx tsx --conditions=react-server`; `verify-tenant-routing` additionally needs
`pnpm build && PORT=3111 pnpm start` and `BASE=http://localhost:3111`.
