# DNMS Codebase Audit

**Date:** 2026-08-24
**Supersedes:** the 2026-08-22 security/correctness audit (its findings are re-verified in §2).
**Scope:** 994 TS/TSX files, 283 API routes, 82 pages, Prisma schema, build + lint toolchain, and the mobile/responsive layer completed on 2026-08-24.
**Focus:** performance (server + client), optimisation, UI/UX and responsive correctness — plus verification that the previous audit's fixes actually landed.

> **This is an audit.** Only two items were changed during it — both regressions introduced by the immediately-preceding mobile work, listed in §1 and already fixed and shipped. Everything else is described, not changed.

---

## Methodology

Four independent auditors read the real files in parallel:

1. **DB & server performance** — N+1s, unbounded reads, indexes, transactions.
2. **Client bundle & React runtime** — barrels, dynamic imports, memoisation, polling, images.
3. **UI, responsive & design consistency** — with an explicit brief to find what the just-finished mobile pass _missed_.
4. **Prior-audit verification** — every Critical/High and the 12 worst Mediums from `AUDIT.md` re-opened against current source.

Claims were then spot-checked by hand where they were load-bearing: the DB pool config, the 11 concurrent scans in `storage.service.ts`, the barrel-beside-`dynamic()` contradiction, the 729 KB brand-mark, the `overflow-x-auto` gate, and `/more` on desktop. Two agent claims were **rejected** on verification and are recorded in §7 so they are not re-reported.

**Confidence:** line numbers are approximate. Anything scale- or environment-conditional is marked as such.

---

## Executive summary

| Severity     | Count | Headline                                                                                                                                                         |
| ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | 5     | Unbounded full-table reads on the app's hottest endpoints; 11 concurrent scans vs a 10-conn pool                                                                 |
| **High**     | 21    | Sequential N+1 loops in request paths; missing composite indexes; barrel imports defeating code-splitting; clipped tables and unreachable dialog buttons at `md` |
| **Medium**   | 28    | Render-cost hotspots, redundant polling, oversized images, tap targets, design-token drift                                                                       |
| **Low**      | 12    | Latent defaults, stray radii, cosmetic wrapping                                                                                                                  |

**Two regressions from the 2026-08-24 mobile work were found and fixed during this audit** (§1).

**Health of the previous audit:** 17 of 26 re-checked findings are genuinely **FIXED** with real enforcement; 6 remain open (all previously flagged "deferred"); 3 are partial. Two _undocumented_ gaps were found in supposedly-complete fixes.

**The single biggest theme:** the server is fast at the edges (JWT auth with no per-request DB hit, SSE instead of polling, correctly-batched chat unread counts) but has a **small number of endpoints that read entire tables** — and a 10-connection pool that turns each of those into an app-wide stall rather than one slow page.

---

## 1. Regressions found and fixed during this audit

Both were introduced by the mobile responsive pass. Both are fixed, type-checked and building.

### 1.1 `DataTable` lost horizontal scroll at exactly the tightest breakpoint — **HIGH, FIXED**

`components/shared/data-table.tsx:184` gated the scroll container on the optional `minWidth` prop:

```tsx
<div className={cn(cardsOn && "hidden md:block", minWidth && "overflow-x-auto")}>
```

Mobile cards stop at `md`, but the 224px sidebar _starts_ at `md`. So **768px is the narrowest content column in the whole app** (768 − 224 − 48 ≈ 496px) — tighter than the 358px phones get _after_ cards. 16 `DataTable` callers pass no `minWidth`; at 768px their right-hand columns were clipped by `main`'s `overflow-x-hidden` with no way to scroll to them. `payroll-directory` renders 10 columns (320px of cell padding alone) into 496px.

**Fixed:** `overflow-x-auto` is now unconditional.

### 1.2 `/more` rendered a blank page on desktop — **MEDIUM, FIXED**

`app/(dashboard)/more/page.tsx` wrapped its only content in `md:hidden`, so at ≥768px the route resolved, the shell rendered, and the content area was empty. Reachable by bookmark, deep link, or rotating a tablet.

**Fixed:** desktop now renders a short explainer pointing at the sidebar plus a link to the dashboard.

---

## 2. Prior-audit verification (`AUDIT.md`, 2026-08-22)

Re-opened against current source. **17 FIXED · 6 STILL OPEN · 3 PARTIAL.**

### Confirmed fixed (evidence sampled)

| ID          | Finding                                     | Enforcement now in place                                                                                               |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **SEC-01**  | Any employee could read anyone's HR docs    | `employee-documents.service.ts:19-20` — `canReadAny` + owner check; base `employee` role lacks `employee:read` in seed |
| **SEC-02**  | Password vault not project-scoped           | `passwords/[entryId]/route.ts:19` — `findFirst({ where: { id, projectId } })` **before** the ownership check           |
| **SEC-03**  | Cron auth failed open with no `CRON_SECRET` | `server/cron-auth.ts:32-35` fail-closed 401; all **13/13** routes call it first                                        |
| **SEC-04**  | Recruitment PII open to all staff           | `withAuth(PERMISSIONS.RECRUITMENT_READ/WRITE)` on all applicant + interview routes                                     |
| **SEC-06**  | `Bearer undefined`, non-constant-time       | `cron-auth.ts:44` length pre-check + `timingSafeEqual`                                                                 |
| **SEC-07**  | Cross-project Drive deletion                | `project-drive.service.ts:152-156` membership check before trash                                                       |
| **SEC-08**  | Company payroll totals exposed              | `payroll/summary/route.ts:10` — `PAYROLL_WRITE`                                                                        |
| **API-01**  | Leave/WFH decision TOCTOU                   | `leave.service.ts:1335` — `updateMany({ where: { id, status: "PENDING" } })` in a transaction, 409 on 0 rows           |
| **API-02**  | Half-day charged 0.5 across a range         | `leave.service.ts:992` rejects multi-day half-days                                                                     |
| **API-03**  | Poll vote not atomic                        | `server/message-cards.ts:262` — Serializable transaction + P2034 retry                                                 |
| **API-05**  | Project-code race                           | `projects/route.ts:62-95` — P2002 retry loop                                                                           |
| **API-06**  | Checklist item ignored `taskId`             | `checklist/[itemId]/route.ts:24,29` — taskId match + `canAccessProject`                                                |
| **UI-01**   | Edit-project form discarded edits           | `project-form-dialog.tsx:80-88` — `wasOpen` ref, deps `[open]`                                                         |
| **DUP-02**  | Cron auth hand-rolled 13×                   | single `assertCron`                                                                                                    |
| **PERF-01** | Chat badge = COUNT per conversation         | one grouped `$queryRaw` — _the remediation note wrongly lists this as deferred; it is fixed_                           |
| **PERF-06** | `listConversations` N unread counts         | same grouped raw query, identical `hiddenFor` predicate — _also wrongly listed as deferred_                            |
| **PERF-07** | Payroll summary summed in JS                | `aggregate` + `groupBy`                                                                                                |

### Still open

| ID          | Finding                                           | Current state                                                                                                                                                                                            |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DUP-01**  | Payroll PATCH formula diverges from the generator | `payroll/records/[id]/route.ts:112` omits `telephoneAllowance` and recomputes statutory deductions the generator hard-zeros. **A payslip's total changes if you edit it.** No shared `computePayslip()`. |
| **PERF-02** | `projects/performance` double full-table scan     | `route.ts:51` + `:207`, no `take`                                                                                                                                                                        |
| **PERF-03** | `GET /api/tasks` unpaginated                      | `tasks/route.ts:141`                                                                                                                                                                                     |
| **PERF-04** | Project messages unpaginated, re-sorted in JS     | `messages/route.ts:96`                                                                                                                                                                                   |
| **API-07**  | Résumé stores a 1-year URL clamped to 7 days      | migration-blocked (needs a `resumeKey` column)                                                                                                                                                           |
| **API-08**  | `requeueStuckSends` measures from `createdAt`     | migration-blocked (needs `claimedAt`)                                                                                                                                                                    |

### Partial — with two **newly discovered** gaps

- **SEC-05** — flooding is fixed (`rateLimited` per IP + per email), but `auth.service.ts:40-41` still returns a distinguishable message, so the **enumeration oracle remains**.
- **API-04** — NaN guard added, but `tasks/[id]/route.ts:238-243` still lets a **client-supplied `loggedHours` overwrite system-measured time**.
- **API-09** — WFH moved to UTC month bounds; **leave did not** (`leave.service.ts:1058,1076` still use local midnight for CL/SHORT quotas, while the EL window three lines away uses `Date.UTC` — the inconsistency is visible in-file).
- 🔴 **NEW —** the WFH **cancel** path (`wfh.service.ts:528`) skips the atomic status claim that API-01 added everywhere else: a plain `update` with no `status: "PENDING"` guard.
- 🔴 **NEW —** `wfh.service.ts:458→467` checks for a duplicate then inserts with **no transaction and no unique constraint** (`schema.prisma:909` has no `@@unique([employeeId, date])`) — two concurrent submissions both succeed.

---

## 3. Server & database performance

### Critical

**3.1 `app/api/projects/performance/route.ts:51` — whole `project_tasks` table per page load.**
For an admin with no filters, `where` collapses to `{ AND: [] }`. Prisma streams every row into Node and tallies in a JS loop (`:164`). A second scan follows at `:207`.
→ `groupBy`/`COUNT(*) FILTER`, and require a date window.

**3.2 `app/api/tasks/route.ts:141` — My Tasks returns the whole task table.**
No `take`/`cursor`; uses `include` not `select`, so three `@db.Text` columns (`description`, `holdReason`, `discardReason`) plus four relations ship per row. With `scope=all` + `project:write`, `assigneeIds` is every active employee.
→ cursor-paginate; `include` → `select`; drop text columns from the list payload.

**3.3 `features/storage/server/storage.service.ts:100-160` — 11 unbounded scans in one `Promise.all`.** _(hand-verified: 11 `findMany`, 0 `take`)_
Against a pool of **10** (`server/db.ts:9`) with a 5s `connectionTimeoutMillis`, this saturates the pool and fails _unrelated requests app-wide_ while it runs.
→ sequence in sub-pool chunks, `select: { objectKey: true }`, page the scan.

**3.4 `features/projects/server/meta-sync.service.ts:402-419` — `upsert` inside a `for` over `campaigns × days`.**
100 campaigns × 30 days = 3,000 sequential round trips. Same shape at `:368`.
→ chunked `createMany({ skipDuplicates })` + one bulk `UPDATE … FROM (VALUES …)`.

**3.5 `app/api/attendance/export/route.ts:35` — CSV export with no mandatory date bound.**
Every filter is optional, so a bare call is `where: {}` over all attendance logs, joined per row, materialised, then string-concatenated. The sibling `attendance-directory.queries.ts:52` already clamps to `MAX_RANGE_DAYS` — this one doesn't.
→ require and clamp a range; stream.

### High

| #    | Location                                                        | Defect                                                                                                                                                         |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.6  | `performance/evaluations/generate/route.ts:47-70` (+ cron twin) | 3 serialized queries **per employee** (~900 for 300 staff); no `@@unique([employeeId, periodLabel])`, so a concurrent cron + manual run duplicates evaluations |
| 3.7  | `leave-accrual.service.ts:473`                                  | `for (const e of employees) await allocateFromPolicy(...)` — read + multi-statement transaction per employee, **inside an HTTP request**                       |
| 3.8  | `attendance/server/sync.ts:468-526`                             | one `upsert` per employee-day; a `?full=1` backfill is `employees × up to 730` writes                                                                          |
| 3.9  | `leave.service.ts:956-1180`                                     | `applyLeave` awaits ~10 queries back-to-back before its transaction; ≥6 are independent; four have no `select`                                                 |
| 3.10 | `task-audit.ts:123` + `schema.prisma:293`                       | filters `entityType+entityId` with **no supporting index** → full scan, fanned out up to 50-wide by `task-status-periods.ts:231` against a 10-connection pool  |
| 3.11 | `task-status-periods.ts:157,170`                                | two `for` loops each doing up to 50 serial `findUnique`/`findMany` hops — 100 RTTs before real work → one `WITH RECURSIVE` CTE                                 |
| 3.12 | `progress.queries.ts:223`                                       | every non-rejected task, no `take`, joined, to compute counters and then slice 40                                                                              |
| 3.13 | `projects/[id]/messages/route.ts:96`                            | all messages + reactions + `_count`; DB ordering discarded and re-sorted in JS, making pagination impossible; search uses `ILIKE %q%` with no trigram index    |
| 3.14 | `messages/[messageId]/replies/route.ts:66`                      | every reply, no `take`, 7-way `include` → ~10 queries per thread open                                                                                          |
| 3.15 | `projects/[id]/tasks/route.ts:15`                               | project board unbounded, `include` of wide rows                                                                                                                |
| 3.16 | `meta-sync.service.ts:268`                                      | all metrics ever synced, summed in JS (docstring admits "undefined = all synced data")                                                                         |
| 3.17 | `recruitment/applicants/route.ts:15` + `jobs/[id]/route.ts:26`  | both unbounded; the second nests all applicants + interviews → thousands of PII rows                                                                           |

**3.18 Missing composite indexes** (`prisma/schema.prisma`) — pure migration, no app change:

| Model             | Add                                                                                 | Why                                                               |
| ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ProjectTask`     | `@@index([assigneeId, dueDate])`, `([projectId, dueDate])`, `([projectId, status])` | **no `dueDate` index exists at all**; every hot query sorts on it |
| `AuditLog`        | `@@index([entityType, entityId, createdAt])`                                        | see 3.10 — the worst pool-saturation path                         |
| `Evaluation`      | `@@unique([employeeId, periodLabel])`                                               | see 3.6 — also prevents duplicates                                |
| `LeaveRequest`    | `@@index([status, createdAt])`                                                      | every list sorts `createdAt` with `skip`/`take`, no index         |
| `WfhRequest`      | `@@index([status, createdAt])`                                                      | same                                                              |
| `ProjectActivity` | `@@index([projectId, createdAt])`                                                   | indexed separately, queried together                              |

### Medium

- **3.19 `lib/notifications.ts:100-108`** — `notifyApprovers` loops `await createNotification`, each of which is an INSERT **plus** a push-subscription lookup. 6 approvers = 12 serialized queries where 2 would do. A batched `createNotifications` already exists but still loops the push. **51 call sites**, several in loops.
- **3.20 `renewals.service.ts:187` → `escalation.ts:70`** — nested N+1: `assets × (3 + 2×recipients)` serialized round trips.
- **3.21 `uptime.service.ts:114-135`** — probes correctly parallel, then one serialized `update` per monitor.
- **3.22 `noticeboard.service.ts:80-84`** — a capped `findMany` paired with a second **unbounded** one purely to compute 4 aggregates in JS.
- **3.23 Missing transactions** — `tasks/route.ts:224+247` and `projects/[id]/tasks/route.ts:53+74` create a task then `openFirstStatusPeriod` **outside a transaction**, breaking the documented "exactly one open period" invariant on failure. The PATCH path does it correctly.
- **3.24 `server/api-handler.ts:92-124`** — `normalize()` runs `res.clone().json()` on **every** response across all 283 routes, then re-serialises. Doubles CPU/heap on the unbounded endpoints above.
- **3.25 `server/db.ts:9`** — `max: 10` in production _(hand-verified)_. Not a defect alone, but the **amplifier** that turns 3.3 and 3.10 into app-wide stalls.

---

## 4. Client bundle & React runtime

### The dominant defect: barrel imports defeat code-splitting

`features/projects/index.ts` is 31 `export *` lines → **33,851 transitive lines**. `package.json` has **no `"sideEffects": false"`**, so those chains cannot be tree-shaken. The repo documents the correct rule in `projects/progress/page.tsx:82-84` and follows it in **1 of 16** dynamic-import sites.

- **4.1 HIGH — `app/(dashboard)/projects/[id]/page.tsx:17-22,51`** _(hand-verified)_. The page statically imports hooks and components **from the same barrel** that its **9** `dynamic(() => import("@/features/projects"))` calls target. A static import lands the module in the eager chunk, so the async chunks resolve to already-loaded code: **the 14 lazy tabs are a no-op**, and `tasks-sheet-view` (2,155 lines), `messages-tab` (1,637) and 5 recharts components load on first paint of the busiest detail route. The comment claiming "each now loads on first activation" is false.
- **4.2 HIGH — `components/layout/topbar.tsx:21` + `mobile-more-menu.tsx:26`** — `useEmployee` from `@/features/employees` (43 modules / 10,209 lines) for one hooks file, in the **shared layout chunk on every authenticated route**. Widest-reach single line in the repo.
- **4.3 HIGH — `project-form-dialog.tsx:18`** — imports `@/features/employees`; because the projects barrel `export *`s this file, this one line is why that closure is 33,851 instead of ~12,658 lines.
- **4.4 HIGH — `task-create-dialog.tsx:22`** — `useSeoSites` from `@/features/seo` drags 19 modules including a recharts-importing tab. Line `:20` in the same file already uses a concrete path.
- **4.5 HIGH — `projects/progress/page.tsx:25-32`** — the file that documents the rule breaks it.
- **4.6 MED-HIGH — `@/features/admin`** imported by **32 files** for a 37-line `usePermissions` hook that ships beside two large forms.
- **4.7 MED — self-importing barrels** (`employee-sync-panel.tsx:22`, `wfh-requests-inbox.tsx:15`) create cycles and force whole-barrel loads.
- **4.8 LOW-MED — no `"sideEffects": false`** in `package.json` — the multiplier that makes all of the above real bytes.

### Runtime cost

- **4.9 HIGH — `messages-tab.tsx:626-630`** — an **ungated 1-second `setInterval`** re-renders the whole thread; each render runs `deliveryFor()` per bubble, which is `members.filter().map()` with `readers.find()` **inside the map** (O(members × readers)), unmemoised, over an **unpaginated** reply list. ≈29k array ops + 200 rich re-renders _per second_.
- **4.10 HIGH — composer keystrokes re-render entire message lists** (`messages-tab.tsx:553`, `chat-view.tsx:466`). Every row inline-renders a Radix `DropdownMenu` with fresh callbacks; `React.memo` appears in only 2 files repo-wide.
- **4.11 MED-HIGH — `tasks-sheet-view.tsx:1037`** — footer totals loop `columns × rows × cells` unmemoised on a 30s tick (~1,280 components/tick). The reasoning in the comment is valid; the fix is to expose the tick from `useTick` (`:425` discards it) and memo on it.
- **4.12 MED — `employee-form.tsx:550`** — bare `watch()` subscribes to all ~50 fields, re-rendering a ~360-line step per keystroke.
- **4.13 MED — `recruitment/page.tsx:121,188`** — `?? []` mints a new identity so the `useMemo` never hits; a derived-state effect double-renders and **silently clobbers unsaved edits** on refetch.
- **4.14 MED — `project-mailer-tab.tsx:1717`** — a reset effect keyed on data from a **5s poll** blanks a half-written campaign body mid-compose. Same shape in `brand-tab.tsx:205`.
- **4.15 MED — redundant polling.** `use-unread-notifications` and `use-unread-chat` both poll at 20s in the layout, but `realtime-notifications.tsx:112` already invalidates `["notifications"]` on every SSE push, which prefix-matches both. ~3 wasted req/min per open tab, forever.

### Images & fonts

- **4.16 HIGH — `width={4500} height={1167}` logos with `priority`, rendered at 123-185 CSS px**, in 5 files. **Zero `sizes` props exist in the repo** _(hand-verified: 0 matches)_, so Next clamps to the largest device size and serves a **3840w** re-encode for a ~154px slot. Worse: light and dark variants both render (CSS-hidden) and **both carry `priority`** — two competing preloads on the app shell.
- **4.17 HIGH — `platform-intro.tsx:73`** — `<img src="/brand-mark.png">` is **729 KB, 2505×2200** _(hand-verified)_, served raw at 36×36 px on the **public landing page**. The same file is `icons.apple`, so iOS downloads 729 KB for a home-screen icon.
- **4.18 MED — `app/layout.tsx:11-16`** — passing an explicit 5-weight array to the variable font `Inter` forces static instances: **7 woff2 / 224 KB**. Dropping `weight` uses the single variable file.

### Client-boundary placement

- **4.19 MED-HIGH — `docs/[slug]/page.tsx`** is client only for `useParams()` (App Router passes `params` as a prop), and `guide-content.tsx` statically imports all 7 guides — so **~975 lines of static prose ship and hydrate on the client, and every slug ships all 7**.
- **4.20 MED — `marketing/sections/hero.tsx:5`** — `motion/react` (~30-35 KB gz, not in `optimizePackageImports`) on the **public LCP element**, for entrance fades the repo's own `.animate-dnms-fade-up` already does with a `prefers-reduced-motion` guard.
- **4.21 MED — `admin/permissions/page.tsx`** is client for two `useQuery` calls with zero interactivity; the server-prefetch + `HydrationBoundary` pattern already exists in `dashboard/page.tsx`.
- **4.22 MED — `date-field.tsx:6`** statically imports react-day-picker (~25 KB gz) into all **22** routes using `DateField`, though the calendar only renders after a click.

---

## 5. UI, responsive & design

### High

- **5.1 `components/shared/pagination.tsx:59`** — the pager row has **no `flex-wrap`**: Prev + 7 numbers + Next ≈ 364px against a 358px (390px screen) or 288px (320px) column. `main` is `overflow-x-hidden`, so **"Next" is silently unreachable** — no scrollbar, no clue. Affects every paginated page.
- **5.2 `portal/[projectRef]/inventory/page.tsx:81`** — `overflow-hidden` (not `-x-auto`) on a 4-column table with ~420px of min-content. Columns are **cut off with no way to reach them**, on a client-facing page. Same in `inventory/loading.tsx:25`.
- **5.3 `components/ui/alert-dialog.tsx:37`** — `AlertDialogContent` has **no width gutter and no height cap**, unlike `dialog.tsx:51` (`w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)]`). At 390px every AlertDialog is edge-to-edge, and a tall one (leave decision, reject reason, task status) **overflows both ends with no internal scroll — the action buttons are unreachable**.
- **5.4 `features/projects/components/messages-tab.tsx:170`** — `h-[68vh] min-h-120` ignores the new bottom tab bar. `chat-view.tsx:207` explicitly documents fixing exactly this; **messages-tab was missed**. On a 568px-tall phone the composer sits behind the tab bar.
- **5.5 `components/shared/ai-assistant.tsx:81`** — `fixed bottom-5 z-50` puts the panel **on top of the mobile tab bar** (~60px + safe-area), and its `100vh-6rem` height doesn't subtract it.
- **5.6 Seven dialogs override the base `max-h-[calc(100dvh-2rem)]` with `vh`** (`project-form-dialog:193`, `requirement-dialog:87`, `document-upload-dialog:94`, `announcements-board:293`, `recipient-import-dialog:297`, `campaign-history-dialog:135`, `leave-decision-dialog:252`). `twMerge` makes the caller win, so on iOS Safari `90vh` exceeds the _visible_ viewport and the submit button falls behind browser chrome — regressing the dvh fix. Five also add a second scroll container.
- **5.7 `chat-view.tsx:731`** — the mobile-only chat **back button has no accessible name** and is a 32px target. It is the _only_ way back to the conversation list below `lg`.
- **5.8 `admin/permissions/page.tsx:69-116`** — hardcoded `slate-*` with no dark variants on a `bg-card` surface: the whole role × permission matrix is **unreadable in dark mode** (the app's default).

### Medium

- **5.9 `components/shared/info-row.tsx:26`** — no `min-w-0`/`break-all`; an unbreakable email pushes the grid wider than the column and is clipped (live on both profile pages).
- **5.10 `components/shared/stat-card.tsx:36`** — no `min-w-0` on the text column, no `shrink-0` on the icon tile: at 320px "PENDING REQUESTS" overflows and squashes the tile.
- **5.11 `data-table.tsx:158-170`** — the **auto** mobile card drops `column.className`, so the two columns relying on it for truncation (`holidays:186`, `wfh:80`) render at full length on phones.
- **5.12 `data-table.tsx:135,249`** — clickable rows are `div`/`tr` with `cursor-pointer` but **no `role="button"`, `tabIndex`, or key handler** — the primary interaction on every table is keyboard-inaccessible.
- **5.13 `topbar.tsx:81,109,128`** — every persistent header control is a 32px target on a bar that is always on screen.
- **5.14 `view-toggle.tsx:45+`** — 28×32px buttons with `title` but no `aria-label`; this is how you switch views on a phone.
- **5.15 `salary-structure-form.tsx:211 vs :219`** — header tracks `[1fr_90px_120px]` vs body `[1fr_80px_110px]`: the "%" and "Amount" labels are **misaligned with their inputs at every width**.
- **5.16 19 icon-only buttons with no accessible name** (resources-tab, teams-tab, projects-client, careers-manager, passwords-tab, task-detail-sheet).
- **5.17 `components/ui/button.tsx:30`** — `icon: "h-9 w-9 rounded"` (4px) sits directly above `icon-sm: "… rounded-[2px]"`. Two sanctioned sizes, two radii, in the core primitive — it propagates everywhere.
- **5.18 Radius drift** — 424 `rounded-[2px]` vs **175 bare `rounded`**; 6 `AlertDialogContent className="rounded"` overrides plus `sm:rounded` in the base make confirm/delete dialogs visibly rounder than every other dialog.
- **5.19 Hand-rolled status chips** with raw `gray-*`/`red-*` and **no dark variants** (`leave/types:126,164`, `payroll-directory:316`, `wfh:87`) — `StatusBadge` exists precisely to replace these.
- **5.20 `stat-strip.tsx:58`** — 2-up cells with no `min-w-0` and untruncated `tracking-widest` uppercase labels overflow at 320px.
- **5.21 Chart palettes are raw hex with no dark handling** — `dashboard-charts.tsx:29-33` uses `#555`/`#888`/`#333`, near-invisible on the dark background.

### Low

- **5.22** `attendance-directory-client.tsx:220,224` — two `w-44` date fields force a 3-row filter block at 390px (wraps correctly; cosmetic).
- **5.23** `components/ui/sheet.tsx:39` — default `w-3/4` (292px) is latent: every current caller overrides with `w-full`, the next one won't.
- **5.24** `features/marketing/**` + auth run a second design system: 101 × `rounded-[6px]`, and `const BRAND_RED = "#ef4444"` redeclared verbatim in **13 files**. Auth straddles both systems and is the first thing users see.
- **5.25** 22 TODO/FIXME markers and 20 `console.log` calls remain in app code.

---

## 6. Tooling & configuration

- **6.1 HIGH — ESLint does not run. ✅ FIXED 2026-08-24** (see §8 Tier 1 item 4 for the two-part root cause) — `npx eslint .` crashes with `TypeError: Converting circular structure to JSON` from `@eslint/eslintrc`'s config validator. `eslint.config.mjs` uses `FlatCompat` to load `next/core-web-vitals` under **ESLint 10.4**, and `next lint` was removed in Next 16 (it now resolves `lint` as a directory). **Static analysis is silently disabled for the whole repo** — several findings above (unused imports, missing `key`, `no-img-element`, exhaustive-deps) are exactly what it would have caught. → migrate to `eslint-config-next`'s flat config without `FlatCompat`, or pin ESLint 9.
- **6.2 NEW — the lint backlog that 6.1 was hiding.** With ESLint working, the repo reports **352 problems (110 errors, 242 warnings)**. None are introduced by the repair; all were simply invisible. By rule:

  | count | rule                                         | severity  | note                                                                                                                                   |
  | ----- | -------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
  | 221   | `@typescript-eslint/no-unused-vars`          | warn      | dead imports/vars; mostly noise, cheap to sweep                                                                                        |
  | 72    | `react-hooks/set-state-in-effect`            | **error** | cascading re-renders — same class as §4.10                                                                                             |
  | 18    | `react-hooks/static-components`              | **error** | components declared inside components → **remount every render**; 16 in `payroll/records/[id]/page.tsx`, 2 in `attachment-preview.tsx` |
  | 17    | `react-hooks/exhaustive-deps`                | warn      | stale-closure risk                                                                                                                     |
  | 5     | `react/no-unescaped-entities`                | error     | cosmetic                                                                                                                               |
  | 4     | `@typescript-eslint/no-explicit-any`         | error     | 2 in `prisma/seed*.ts`, 1 in `server/api-handler.ts`                                                                                   |
  | 3+3+2 | `react-hooks/refs`, `immutability`, `purity` | error     | genuine hook-rule violations                                                                                                           |
  | 1     | `@next/next/no-sync-scripts`                 | error     | the deliberate `theme-boot.js` in `app/layout.tsx` — should carry a scoped disable                                                     |

  The two clusters worth fixing on merit are **`static-components`** (a real, measurable perf bug) and **`set-state-in-effect`**. The 221 unused-vars are a mechanical sweep. Recommend fixing those two clusters, then setting `--max-warnings` in CI to lock the level in.

- **6.3 Prettier is clean** across the repo — formatting is not a concern.
- **6.4 `next build` succeeds** in ~30-52s with no type errors (`tsc --noEmit` clean). Next 16 no longer prints per-route bundle sizes, so size regressions cannot be tracked from build output alone — consider `@next/bundle-analyzer` in CI given §4.
- **6.5 Client chunks total ~9.0 MB on a clean build.** (An earlier 6.6 MB reading came from a non-clean `.next`; the two are not comparable. Two clean builds before and after the Tier-1 work both measure 9.0 MB.); largest is 424 KB and contains `xlsx` — **correctly lazy** (`recipient-import-dialog.tsx:138`), so not initial load.

---

## 7. Claims investigated and rejected

Recorded so they are not re-reported:

- **"`xlsx` bloats the bundle"** — false. It is `await import("xlsx")` behind a click; the 424 KB chunk is lazy.
- **"recharts is eagerly loaded"** — false. Dynamic at all 7 sites; `optimizePackageImports` covers lucide/recharts/date-fns.
- **"Tables are stuck as wide scrolling grids on phones"** — false. No caller passes `mobileCard={false}`; all 42 get cards below `md`. (The _real_ table defect was at `md`, §1.1.)
- **"`w-40`/`w-44` filter selects overflow"** — false. `select.tsx:21` (`[&>span]:line-clamp-1`) lets every trigger shrink to ~40px inside its `flex-wrap` row.
- **"Auth re-queries permissions per request"** — false. JWT-based (`server/auth.ts:209`), and `proxy.ts` does no DB work.
- **"Realtime uses polling"** — false. Both streams use Postgres `LISTEN/NOTIFY`.

---

## 8. Recommended order of work

**Tier 1 — cheap, wide, no behaviour change — ✅ DONE (2026-08-24)**

1. ✅ Composite indexes (§3.18) — shipped as migration `20260824000000_perf_indexes`, **9** indexes (not 6), verified present in the DB. Checked for pre-existing duplicate rows first: 0 evaluation dupes, 0 WFH dupes.
   - **Deviation:** the recommended plain `@@unique([employeeId, date])` on `WfhRequest` would have been wrong — it blocks re-applying after a rejection, which is legitimate. Shipped a **partial** unique index (`WHERE status IN ('PENDING','APPROVED')`) in raw SQL instead, matching the service's actual duplicate guard.
2. ✅ Barrel imports (§4.1-4.4) — all 9 `dynamic()` calls in `projects/[id]/page.tsx` retargeted at concrete modules, plus topbar, mobile-more-menu, and `usePermissions` across 32 files. 0 `@/features/admin` barrel imports remain.
   - **Deviation:** shipped `"sideEffects": ["*.css"]`, not `false` — a bare `false` would let a bundler drop the one global CSS import.
   - **Unverified:** the byte win is _not_ measured. Next 16/Turbopack emits no per-route `app-build-manifest`, and total chunk bytes _rise_ with more splitting, so there is no like-for-like number. The change is correct by construction (a static barrel import defeats `dynamic()` on that barrel) but the claimed "~10k lines" saving remains unproven.
3. ✅ Images (§4.16-4.17) — all 7 logo sites + brand-mark.
   - **Deviation:** did **not** add `sizes`. These are fixed-size images; supplying `sizes` switches Next to the full `deviceSizes` srcset, which is _worse_. The actual bug was `width={4500}`, which made Next offer 4500w/9000w candidates for a ~123px render. Fixed by declaring the rendered size (370×96).
   - `priority` dropped from the theme-swapped pairs (one preload was always discarded) but **kept** on the lone auth-shell hero logo, which has no twin.
   - **Beyond the audit:** the same master images were also being served raw to email clients, where no optimizer exists — signature 729 KB → 12 KB, header 118 KB → 12 KB. The header was additionally a `.webp`, which **Outlook desktop cannot render at all**; it is now a PNG. This was a live correctness bug, not just a size one.
4. ✅ ESLint (§6.1) — repaired; the repo now lints for the first time.
   - Root cause was **two** stacked failures, not one: `FlatCompat` wrapping configs that are _already_ native flat arrays in `eslint-config-next` v16, and then `eslint-plugin-react@7.37.5` calling `context.getFilename()` (removed in ESLint 10) during React-version auto-detection. Fixed by dropping `FlatCompat` and pinning `settings.react.version`.
   - `package.json` still ran `next lint`, removed in Next 16 — now `eslint .`.
   - **Result: 352 problems (110 errors, 242 warnings) are now visible.** These are pre-existing and untriaged — see §6.2.

**Tier 2 — correctness and stability — ✅ DONE (2026-08-24)**

5. ✅ All five Critical reads bounded, pool raised.
   - **§3.1** `projects/performance` — the tally moved into ONE grouped SQL aggregate (`COUNT(*) FILTER`, grouped by assignee × project; every bucket is additive so summary/byEmployee/byProject are cheap roll-ups). Truncation was rejected outright: the page is nothing but aggregates, so a clipped scan reports confidently wrong totals. **Verified against the old JS on real data: 286 rows → 38 group rows, all 14 buckets identical across summary and every employee and project.** The second scan at `:207` now queries `projects` directly instead of one row per task.
   - **§3.2** `/api/tasks` — the `where: {}` full-table path (no in-app caller) now falls back to the caller's own tasks; `take` cap with **`meta.truncated`** so a clipped list is never presented as complete. **Deviation:** the audit said to drop the text columns — `description` is rendered by my-tasks:697, so only the two genuinely unused `@db.Text` columns were omitted.
   - **§3.3** storage overview — **deliberately still unbounded** (a row it misses becomes a live file "Clean up orphans" deletes), so _concurrency_ was bounded instead: 12-wide → 3-wide, with the B2 call overlapped since it holds no connection.
   - **§3.4** meta-sync — both upsert loops batched via array-form `$transaction` (chunks of 100), collapsing ~3,000 sequential round trips.
   - **§3.5** attendance export — bounded range now mandatory (max 366d), `include` → `select`. No in-app caller, so it was pure DoS surface.
   - **§3.25** pool 10 → 20, sized against the real server (`max_connections=100`, 3 reserved, 11 in use), overridable via `DB_POOL_MAX`.
6. ✅ WFH gaps — closed early alongside item 1 (atomic cancel claim + P2002 catch).
7. ✅ **DUP-01 payroll** — one `computePayslip()`, used by both the generator and the editor. The editor had _two_ divergences, not one: it dropped `telephoneAllowance` from gross **and** applied statutory deductions the generator zeroes. Demonstrated: on a ₹52,000 payslip a single overtime edit silently cut **₹2,800**. Generator behaviour is preserved exactly; the policy is now one named `STATUTORY_DEDUCTIONS_ENABLED` constant instead of a magic `= 0` in one place and a live calculation in the other.
8. ✅ Unreachable controls — pager `flex-wrap` (§5.1), AlertDialog gutter + dvh cap + internal scroll (§5.3), portal inventory `overflow-x-auto` (§5.2), messages-tab dvh height (§5.4), AI panel lifted above the tab bar (§5.5). Also **§5.6**: the six dialogs whose `vh` overrides re-broke the dvh fix, and **§5.18**: six `AlertDialogContent className="rounded"` overrides.

**Tier 3 — polish — ✅ MOSTLY DONE (2026-08-24)**

9. **§4.9 ✅** — `readers.find()` hoisted out of the map into a `Map` (was O(members × readers) per bubble), both helpers `useCallback`'d, and the 1s interval **gated** so it runs only while a message is still inside its 15-minute edit window instead of forever. **§4.10 (composer re-renders) NOT done** — needs `React.memo` on the row components, a real refactor.
10. ✅ Dark mode — permissions matrix off hardcoded `slate-*` onto semantic tokens (§5.8); a theme-aware `CHART_NEUTRAL_SERIES` replaces the `#555`/`#333` greys (§5.21); chips onto the existing `TONE` map (§5.19).
    - **§5.19 partly rejected:** `wfh/page.tsx:87` already had dark variants — the audit was stale on it.
11. ✅ Button radius unified (§5.17); `BRAND_RED` consolidated from 14 local copies into `marketing.constants.ts` (§5.24).
    - **§5.16 partly done, and the audit's count was closer than mine.** I initially "labelled 44" icon buttons — most were false positives that already had `title=`/`sr-only`. **Net new labels: 7**, including the §5.7 chat back button, which also went from a 32px to a 40px target (it is the only way back below `lg`).

**Also fixed, beyond the tier list**

- **API-04** — `loggedHours` is no longer client-writable. It is system-measured, no client ever sent it, and accepting it let anyone set their own "time spent" _and_ silently overwrite the value measured on that same request.
- **API-09** — CL/SHORT monthly quotas moved to `Date.UTC`, matching the EL window three lines away. Local midnight shifted each window by the server's offset, so a request dated the 1st fell into the previous month's quota.
- **§3.23** — both task-create paths are now transactional, so a task can no longer exist without its first status period.
- **§6.2 lint backlog: 352 → 187 problems (110 → 92 errors).**
  - `no-unused-vars` given the repo's own `^_` convention (148 of the 221 were intentional placeholders on fixed handler signatures).
  - `static-components` cleared: `Row`/`RowSkeleton` hoisted out of the payroll page body (16 rows were remounting on every render); the 2 in `attachment-preview` are a **genuine rule false positive** — `iconFor()` returns one of three module-level components — and carry a scoped disable, not a refactor.

**Deliberately NOT changed**

- **SEC-05 (login enumeration oracle).** `auth.service.ts:29-31` documents this as a product requirement: _"This flow deliberately reveals whether an active account exists, per product requirement - it is not anti-enumeration."_ Flooding is already rate-limited per IP and per email. Reversing a documented product decision is the owner's call, not the auditor's — **this needs a decision, not a patch**.
- **§4.15 chat polling.** The audit claims `invalidateQueries(["notifications"])` prefix-matches `["chat","unread-count"]`. It does not. The chat hook documents why it must poll (its SSE stream only runs while the Chat screen is open). The **notifications** half was real and is fixed: 20s → 90s, aligned with the inbox-watch fallback it backs up. It could not be removed entirely — that fallback refetches the inbox but does not invalidate the unread-count key, so the badge would sit stale through an SSE outage.

**Second pass — the remainder (2026-08-24)**

_Server (§3)_

- **§3.24 ✅** `normalize()` no longer does `res.clone().json()`. That teed the stream and buffered every payload a second time on **all 283 routes**; it now reads the body once and hands the original string back on both pass-through branches instead of re-serialising the parsed object.
- **§3.9 ✅** `applyLeave`'s first three reads (leave type, employee, resignation) are independent and now run together instead of as three sequential round trips.
- **§3.13 ✅** project message list bounded (500 threads). **Documented limitation left in place:** the final order is by `lastActivityAt`, which is derived from the newest reply and cannot be expressed in the `orderBy`, so the cap keeps the newest threads _by creation_. Doing it properly needs `lastActivityAt` denormalised onto `projectMessage` — which is also what would make the endpoint genuinely paginable.
- **§3.14 ✅** thread replies bounded (500) with `desc + take + reverse`, so the cap keeps the **newest** replies. Capping the original `asc` order would have kept the oldest and hidden the newest — backwards for a chat.
- **§3.15 ✅** project board bounded (2000) + the two unread `@db.Text` columns omitted.
- **§3.17 ✅** applicants bounded (500).
- **§3.19 ✅** `notifyApprovers` uses the existing batched `createNotifications` — one `createMany` plus non-blocking pushes, instead of 2N serialized queries.
- **§3.21 ✅** uptime sweep: per-monitor `UPDATE` and `findFirst` hoisted out of the loop into one batched write and one keyed read.
- **§3.22 ✅** noticeboard's second, unbounded `findMany` replaced with `groupBy` + three `count`s.
- Every new cap reports `meta.truncated` — no silent truncation anywhere.

_Correctness_

- **API-07 ✅ (was "migration-blocked")** — added `applicants.resume_key`. `getSignedUrl` clamps to 7 days no matter what is requested (`lib/storage.ts:216`), so the stored "one year" link **403'd a week after upload** and every CV became unreachable. There is now a stable `GET /api/recruitment/applicants/[id]/resume` that mints a fresh 5-minute signature per click and redirects; `resumeUrl` is also a free-text field, so external links (LinkedIn, Drive) pass through untouched. The storage orphan-scan now matches CVs on the exact key instead of `resumeUrl.includes(key)`.
- **API-08 ✅ (was "migration-blocked")** — added `project_campaign_sends.claimed_at` + index, backfilled. `requeueStuckSends` measured staleness from `createdAt`, but a bulk campaign inserts every row at once — so once a run outlived the threshold, rows that were **actively sending** were flipped back to PENDING and those recipients got the campaign **twice**.
- Migration `20260824010000_resume_key_and_claimed_at`, applied via `migrate deploy` and verified in the DB (both columns + the index).

_UI (§5)_

- ✅ **5.9** InfoRow `min-w-0` + `break-words`; **5.10** StatCard `min-w-0` + `shrink-0` icon; **5.11** auto mobile card now carries `column.className`; **5.12** clickable rows got `role="button"`, `tabIndex`, Enter/Space and a focus ring (the primary interaction on 42 tables was mouse-only); **5.13** topbar controls 40px on touch / 32px from `md`; **5.14** view-toggle `aria-label`s + 32px targets; **5.15** the salary-structure header track now matches its body track; **5.20** stat-strip `min-w-0` + truncate; **5.23** Sheet default `w-3/4` → `w-full sm:max-w-sm`.

_Runtime (§4)_

- ✅ **4.11** `useTick` now returns its beat, so the footer totals memoise on `[columns, rows, cells, tick]` — recomputing once every 30s instead of on every keystroke, hover and selection. (The existing comment was right that a memo without the tick would freeze the footer; the tick was the missing dependency.)
- ✅ **4.13** recruitment `?? []` → `useMemo`, and the department reset effect keyed on identity only — it was re-running on refetch and **discarding unsaved edits**.
- ✅ **4.14** the campaign composer reset no longer fires on the 5s poll, and `brand-tab` seeds once instead of overwriting in-progress typing on every refetch.

_Lint_ — **352 → 184** (110 → 91 errors). `static-components` fully cleared.

**Still open, with reasons**

- **§4.10 composer re-renders** — needs a leaf bubble component extracted from an ~860-line inline `Thread` and wrapped in `React.memo`. A real refactor on the most-used surface, and it cannot be verified without exercising the chat UI. The _algorithmic_ half (the O(members × readers) per bubble) was fixed in §4.9.
- **§4.12 employee-form `watch()`** — `watchedValues` is read for 33 distinct fields across 73 references, so a targeted `watch([...])` saves almost nothing. The real fix is restructuring a 1,500-line form into individually-subscribed sub-components.
- **§3.6-3.8, §3.11-3.12, §3.16, §3.20** — remaining N+1s, each needing its own restructure. §3.10's supporting index landed in Tier 1, so its worst path (the 50-wide fan-out) is already far cheaper.
- **§5.22** — cosmetic; the audit itself notes it wraps correctly.
- **§5.25 — REJECTED.** All 20 `console.log` calls are intentional scheduler operational logging in one server file (two are inside doc comments). Removing them would make the background workers silent.
- **Remaining lint:** 71 `set-state-in-effect`, 73 genuinely-dead unused vars, 16 `exhaustive-deps`.

---

## 9. What is genuinely good

Worth recording so it isn't "fixed" later:

- **Security posture has held.** Every Critical/High from the prior audit is closed with real enforcement — permission constants, project-scoped `findFirst` before ownership checks, fail-closed cron auth with `timingSafeEqual`, atomic `updateMany … where status: 'PENDING'` claims, Serializable poll votes.
- **Credentials are deny-by-default** at the Prisma client level (`server/db.ts` global `omit`), so a careless `include` cannot leak a password hash.
- **Realtime is done properly** — Postgres `LISTEN/NOTIFY`, not polling.
- **Chat is the best-optimised feature** — grouped `$queryRaw` unread counts, `take` caps on every list, cursor pagination.
- **The heavy libraries are already lazy** — recharts, `xlsx`, the 68 KB emoji dataset.
- **`components/ui` is lean** (1,624 lines total) and no barrel re-exports server code.
- The mobile layer's shared primitives (`PageHeader`, `Tabs`, the portal shell mirroring the staff shell) verified correct on independent review.
