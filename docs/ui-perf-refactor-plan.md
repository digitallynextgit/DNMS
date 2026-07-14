# DNMS — UI Consistency + Performance Refactor Plan

Audit date: 2026-07-14. Four parallel read-only audits (component inventory, UI consistency,
frontend perf, backend/data perf). **Nothing has been changed yet — this is the plan for review.**

---

## The diagnosis in one paragraph

You already have **24 shared components** (`DataTable`, `PageHeader`, `StatusBadge`, `FormDialog`,
`EmptyState`, `Pagination`, `AvatarDisplay`, `DateField`…). The UI is inconsistent for two reasons:

1. **Adoption is partial.** ~half the app bypasses the shared component and hand-rolls its own
   (18 tables don't use `DataTable`; 17 dialogs don't use `FormDialog`; 17 pills don't use
   `StatusBadge`).
2. **The primitives themselves disagree.** `Button` is `h-9` / radius 6px, but `Input`, `Select`
   and `Textarea` are `h-10` / radius 4px. So **every form row is misaligned by 4px at the
   source** — no amount of page-level fixing can hide that.

There are also **3 "shadow" components** — local copies that shadow the real shared one
(`StatCard` in analytics, `StatusBadge` in kpi-profiles, `DateField` in employee-form). Those
actively cause visual drift.

For speed: the app is slow for **specific, fixable reasons**, not "React is slow."
The top three are avatars, client-side-everything, and blocking email sends.

---

# PART 1 — UI CONSISTENCY

## Phase 0 — Foundation fixes (tiny diffs, app-wide effect) ⚡

These are a handful of lines that fix hundreds of places at once. **Do these first.**

| #   | Change                                                            | Files                                                                                                              | Why it matters                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 | `Input`, `Select`, `Textarea` → `h-9` + `rounded-[var(--radius)]` | 3 files, 3 lines                                                                                                   | Buttons are `h-9`/6px; these are `h-10`/4px. **Every filter bar and form row in the app is misaligned.** `filter-bar.tsx:74` already hard-patches this locally — proof it's wrong at the source. |
| 0.2 | Delete the 3 shadow components                                    | `analytics/page.tsx:63` (StatCard), `kpi-profiles/page.tsx:211` (StatusBadge), `employee-form.tsx:216` (DateField) | Local copies that shadow the shared one and drift visually. Pure deletion.                                                                                                                       |
| 0.3 | Strip `className="h-6/h-7/h-8 w-*"` off `size="icon"` buttons     | ~30 files                                                                                                          | `size="icon"` already means `h-9 w-9`. Today there are **4 different icon-button sizes** in the app. This is literally the "buttons are not the same size" complaint. Pure deletion.             |
| 0.4 | Add shared `<Spinner>` + a `loading` prop on `Button`             | new file + `button.tsx`                                                                                            | `<Loader2 className="mr-2 h-4 w-4 animate-spin"/>` is copy-pasted **~50 times** in 5 different sizes. Most-duplicated line in the codebase.                                                      |

## Phase 1 — Status colors: one language

`lib/constants.ts` ships **two mutually exclusive design languages** (bordered+opaque vs
borderless+alpha), plus 3 more one-off families. Consequences:

- `PENDING` is amber in leave but **grey** in evaluations.
- `CANCELLED` is grey in leave, `bg-muted` in projects, **red** in tasks.
- `HALF_DAY` is amber in one attendance page, **orange** in another.
- "Success green" renders as **10 different class strings**.

**Plan:** pick ONE formula (recommend the borderless/alpha family — it dark-modes cleanly), rewrite
all 13 maps in `lib/constants.ts` to it, delete the 8 color maps living outside that file, and
replace the **17 hand-rolled pills** with `StatusBadge`. Also fix `ui/badge.tsx:17` (`success`/
`warning` have **no dark-mode variant at all**).

## Phase 2 — Tables: everything through `DataTable`

**20 files use it, 18 don't.** The 18 diverge on: 4 cell-padding scales, 4 hover colors, 2 header
casings (UPPERCASE vs sentence), S.No present/absent, 3 spellings of "S.No", missing empty states.

- Convert **11 raw `<table>`s** → `DataTable`.
- Convert **3 shadcn `ui/table`** pages (audit-log, email-templates, roles) → `DataTable`.
- **Legit exceptions (leave as-is):** `admin/permissions` (colSpan matrix), `payslip-document`
  (print layout), `docs/info-table` (definition list).
- Drop the **10 duplicate sibling `<Pagination>`** calls in favour of DataTable's `pagination` prop.
- Fix `data-table.tsx:77` radius (`rounded` 4px) to match `Card` (6px).

## Phase 3 — Dialogs, headers, empty states, skeletons

- **17 hand-rolled dialogs → `FormDialog`**; standardize on **3 widths** (sm / md / lg) instead of
  the current **12**.
- **6 pages hand-roll their header** with **4 different title sizes** — so the page title visibly
  changes size as you navigate. Move all to `PageHeader`; add a `backHref` prop so the 4 stray
  Back buttons stop living outside the header.
- **11 hand-rolled empty states → `EmptyState`**; **~23 ad-hoc skeletons → `loading-skeleton.tsx`**
  (incl. a byte-identical `StatCardSkeleton` defined twice).
- **Pick one CTA verb.** Today: 11× "Add X", 4× "New X", 2× "Create X" — and `job-roles` says
  **"Add Role"** while `admin/roles` says **"Create Role"**. Recommend **"New X"** everywhere.
- Adopt the orphaned shared components: `FileUpload` (6 raw file inputs), `DateField` (11 raw
  date inputs), `SearchInput` (4 hand-rolled search boxes), `TimeField`, `DeleteDialog`.

## Phase 4 — New shared components (each replaces 2-5 copies)

| Component                         | Replaces                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `Spinner`                         | ~50 `Loader2 animate-spin` copies                                             |
| `StatStrip`                       | the 4-up stat strip, copy-pasted in **5** files with a local `Stat` cell each |
| `InfoRow` + `SectionHeader`       | **byte-identical** in `employees/[id]` and `profile`, +3 variants             |
| `MonthNav`                        | month-stepper header, **4** copies                                            |
| `PageHeader backHref`             | back-link + title, **4** copies                                               |
| `CalendarLegend`, `ChartSkeleton` | 2 copies each                                                                 |

---

# PART 2 — PERFORMANCE

## P0 — Avatars are the single biggest cost 🔴

`profilePhoto` is stored as `/api/employees/{id}/photo`. **Every avatar on screen** costs:
middleware JWT decode → `withSession` JWT decode **again** → **a DB query** → B2 presign →
**302 redirect** → browser opens a 2nd connection → downloads **the original upload (up to 5 MB)**
to paint a **32×32px** circle → `max-age=300` so it all repeats every 5 minutes.

`AvatarDisplay` is used in **30 files**. On `/projects` (100 projects × owner + members) that's
**hundreds** of such requests.

`next.config.mjs:26` **already whitelists B2 in `images.remotePatterns`** — the optimizer is
configured and nothing uses it. Only 2 files in the whole repo import `next/image`.

**Fix:** serve via `next/image` (auto WebP + resize + CDN cache), cache the signed URL, drop the
per-request DB lookup, raise `max-age` (the `?v=` already cache-busts).

## P1 — Interaction jank: pagination/filter clicks

`use-url-state.ts:33` calls `router.replace()`. Its own comment claims "no server refetch" —
**that's false in the App Router.** Every pagination click, filter change and debounced keystroke
triggers a **full RSC round trip**, which re-runs `(dashboard)/layout.tsx` (`auth()` + a DB query).
Used in **28 places across 23 files**.

And there is exactly **ONE** `placeholderData: keepPreviousData` in the entire repo — so every
other list **unmounts into a skeleton** on every page change.

**Fix:** `keepPreviousData` on every paginated query (rows swap instead of flashing), and use
`history.replaceState` for pure-UI URL state so it stops refetching the route shell.
_This is the cheapest, most-felt win in the whole plan._

## P2 — Over-fetching (one item is a security bug) 🔴

- **`/api/employees` returns EVERY column** — including **`passwordHash`** and
  **`gmailAppPassword`**. `employees.service.ts:118` uses `include:` with no `select:`. The schema
  itself warns _"Never return in API responses"_ at `schema.prisma:421`. **This is a credential
  leak, not just a perf issue.** Fix: explicit `select` (a `EMPLOYEE_SUMMARY_SELECT` already exists
  in `server/selects.ts`).
- `/projects` fetches **100 projects with the full team graph**, then paginates 10/page
  _client-side_ — 90% of the payload is discarded. The API already supports server pagination.
- The "New Evaluation" dialog fetches **100 full employee records on page load** — for a dialog
  that's usually never opened. Gate with `enabled: open`.

## P3 — Blocking email sends inside request handlers 🔴

`lib/mailer.ts:98` builds a **brand-new SMTP transporter per email** (TCP+TLS+AUTH handshake,
300ms–2s each), and handlers **`await`** them serially. Applying for leave with a manager + 3 HR
approvers = **4 sequential SMTP handshakes before the HTTP response returns.**

**You already have the fix in the repo:** `lib/queue.ts:16` `addEmailJob()` is fire-and-forget and
is simply not used at these ~12 call sites. Route them through it + pool the transporter.
**~1 hour of work, cuts seconds off every approve/apply action.**

## P4 — N+1 query loops

| Where                                  | Cost                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `attendance/server/sync.ts:244,370`    | `upsertDay` = 2 queries × employee × day, sequential. A full backfill ≈ **36,000 round trips**.  |
| `payroll/records/route.ts:170`         | 6 sequential queries per employee → **~600** for 100 employees; will flirt with gateway timeout. |
| `leave-accrual.service.ts:184,289,336` | "Re-sync balances" = **~1,200 sequential queries** behind one button.                            |

All three: hoist the reads out of the loop, batch the writes.

## P5 — Everything else

- **51 of 63 pages are `"use client"`** and there is **zero** SSR prefetch (`HydrationBoundary`
  appears 0 times). Every page = hydrate-_then_-fetch waterfall. Fix the top 5 pages with
  `prefetchQuery` + `HydrationBoundary` (client components keep their `useQuery` untouched — the
  cache is just warm).
- **Two polls every 15s on every page** (notifications + resignations), each = JWT decode + DB.
  8 background DB round trips/minute per open tab. Raise to 60-120s.
- `evaluations/[id]/page.tsx:152` defines `SidePanel`/`Section` **inside** the render body → React
  **remounts the entire scorecard on every keystroke** in the comment box.
- `SessionProvider` gets no initial session → `can()` is `false` on first paint → **every
  permission-gated button pops in late**. Reads as slow. One-line fix.
- Bundle: `@hello-pangea/dnd` imported statically on `/projects`; all **7 project tabs (~4,000
  lines)** imported statically. `dynamic()` them (the pattern already exists in `tasks-tab.tsx:64`).
- Missing indexes worth adding: `notifications(employee_id, created_at)` ← **highest value**, it's
  polled every 15s and can't use the existing index for its sort; `audit_logs(module, created_at)`,
  `audit_logs(actor_id, created_at)`, `employees(manager_id)`.

---

# Suggested execution order

| Step  | Scope                                                                       | Risk                                | Payoff                                                      |
| ----- | --------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| **1** | Phase 0 (primitives + shadow components + icon sizes + Spinner)             | Very low — mostly deletions         | Fixes the "buttons aren't the same size" complaint app-wide |
| **2** | P2 security fix (`select` on employees — stop leaking `passwordHash`)       | Very low                            | Closes a credential leak                                    |
| **3** | P1 (`keepPreviousData` + stop RSC refetch) + P3 (email → `addEmailJob`)     | Low                                 | The two biggest _felt_ speedups                             |
| **4** | P0 avatars via `next/image`                                                 | Medium                              | Biggest raw network win                                     |
| **5** | Phase 1 (status colors) + Phase 2 (tables → DataTable)                      | Medium — many files, all mechanical | The "different tables everywhere" complaint                 |
| **6** | Phase 3 (dialogs/headers/empty/skeletons) + Phase 4 (new shared components) | Medium                              | Long-tail consistency                                       |
| **7** | P4 N+1 batching + indexes + RSC prefetch                                    | Medium                              | Server headroom; matters as data grows                      |

Steps 1-4 are the high-leverage ones and are mostly small diffs. Steps 5-6 are the bulk of the
file-touching but each change is mechanical and low-risk.

**Note:** the codebase already knows how to do nearly all of this right — `keepPreviousData`,
`dynamic()`, `optimizePackageImports`, B2 `remotePatterns`, `addEmailJob`, `EMPLOYEE_SUMMARY_SELECT`
all exist. Most fixes are **propagating an existing in-repo pattern**, not inventing anything.
