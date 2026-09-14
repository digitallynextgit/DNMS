# DNMS - Codebase Audit (2026-09-14)

Companion to `docs/codebase-overview.md` (structure, components, journeys). This file holds the
findings.

> **Status: the same-day items have been carried out** (2026-09-14). See the
> [cleanup log](#cleanup-log---what-was-actually-changed) at the end for exactly what changed and
> what deliberately did not. Findings below are written as they were found; the Priority summary
> marks what is now done. One item in §1.1 was **wrong** and is corrected in §7.

## How the audit was run

| Check                         | Tool / method                                                                                                                                   | Result                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Type safety                   | `pnpm type-check` (`tsc --noEmit`)                                                                                                              | **clean** (exit 0)                                                                      |
| Unit tests                    | `pnpm test` (vitest)                                                                                                                            | **9 files, 282 tests passing** (1.1 s)                                                  |
| Lint                          | `pnpm lint` (ESLint 10, `eslint-config-next` 16)                                                                                                | **190 problems: 93 errors, 97 warnings** in 138 files - `pnpm validate` currently fails |
| Unused files / exports / deps | `knip` (Next.js plugin auto-detected) + `depcheck` + grep verification of every claim                                                           | see §1, §2                                                                              |
| Duplicates                    | basename scan, exported-name scan, non-exported "shadow" scan, helper-definition scan                                                           | see §3                                                                                  |
| Data-layer performance        | script over 840 server/API files: Prisma calls inside loops, `findMany` without `take`, `select` vs `include`                                   | see §4                                                                                  |
| Client performance            | `"use client"` pages, `HydrationBoundary` adoption, `refetchInterval`/`EventSource` inventory, `next/dynamic` usage, heavy-library import sites | see §4                                                                                  |
| SEO                           | `robots.ts`, `sitemap.ts`, metadata per layout/page, manifest, OG image, proxy public prefixes, tenant URL scheme                               | see §6                                                                                  |

Numbers in this document were measured on the working tree at commit `ddba72c` (clean).

---

## Priority summary

| #   | Finding                                                                                                                                                  | Priority | Effort  | Status                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------------------------------- |
| 7   | **Migration drift**: 4 schema objects have no migration; `prisma/sql/` is their only DDL (found while cleaning up)                                       | **P0**   | hours   | open - needs a DB to fix            |
| S1  | `prisma/snapshot.json` (committed) contains real employee PII, salaries and payroll rows                                                                 | **P0**   | hours   | untracked + ignored; history open   |
| 2.1 | Three packages installed but never imported (`@auth/prisma-adapter`, `@hello-pangea/dnd`, `@eslint/eslintrc`)                                            | P0       | minutes | **done**                            |
| 1.1 | Dead files and assets: `ui/table.tsx`, 2 project components, 747 KB + 128 KB unused images, 3 stray root data files                                      | P0       | hours   | **done** (SQL files kept - see §7)  |
| 1.4 | `package.json` `export:punches` and 8 doc references point at a deleted `scripts/` directory                                                             | P0       | hours   | **done** (script entry removed)     |
| 4.3 | Polling kept alongside SSE: up to 12+ requests/min per open project for data the stream already pushes                                                   | P1       | hours   | **done**                            |
| 6.1 | `robots.ts` disallow list never matches real app URLs (`/{tenant}/...`); no `noindex` on gated layouts                                                   | P1       | hours   | **done**                            |
| 6.2 | `/signup` and `/login` inherit `canonical: "/"` from the root layout while `/signup` is in the sitemap                                                   | P1       | minutes | **done**                            |
| 6.3 | No web app manifest despite service worker + icons                                                                                                       | P2       | hour    | **done**                            |
| 1.5 | Config debris: `typescript.ignoreBuildErrors: true`, dead `pnpm.onlyBuiltDependencies`, two copies of the project standard, one-line README              | P2       | hour    | **partly** - config done; docs open |
| 4.1 | 49 client-rendered pages, only 5 use server prefetch; project page lazy-loads 19 tabs through one barrel                                                 | P1       | days    | open                                |
| 4.2 | `await auth()` in the root layout makes the public marketing site fully dynamic (no static/CDN caching)                                                  | P1       | hours   | open                                |
| 4.4 | 72 `react-hooks/set-state-in-effect` errors, mostly in shared components every screen uses                                                               | P1       | days    | open                                |
| 3.x | Duplicate components/helpers (`StatusBadge`, `StatCard`, tab `Badge`, two date-range pickers, `formatDate` ×4, `formatBytes` ×2, `formatDuration` ×3, …) | P2       | days    | open                                |
| 1.2 | 228 unused exports + 162 unused exported types (knip)                                                                                                    | P2       | days    | open                                |
| 4.5 | 26 Prisma-in-loop sites (N+1), ~263 unbounded `findMany` (heuristic)                                                                                     | P2       | days    | open                                |

---

## 1. Unnecessary files and dead code

### 1.1 Files with zero references (each verified by grep after knip flagged it)

| File                                                                                               | Evidence                                                                                                                                                             | Action                                                                    |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `components/ui/table.tsx`                                                                          | 0 imports of `components/ui/table` anywhere (even `DataTable` does not use it)                                                                                       | delete, or make `DataTable` use it                                        |
| `features/projects/components/owed-deliverables-panel.tsx`                                         | `OwedDeliverablesPanel` has 0 import sites                                                                                                                           | delete                                                                    |
| `features/projects/components/weekly-hours-card.tsx`                                               | `WeeklyHoursCard` has 0 import sites                                                                                                                                 | delete                                                                    |
| `features/admin/index.ts`                                                                          | 0 imports of `@/features/admin`; consumers import internals directly (8 sites, e.g. `app/(dashboard)/recruitment/page.tsx` → `features/admin/hooks/use-permissions`) | either route consumers through the barrel (the CLAUDE.md rule) or drop it |
| `features/recruitment/index.ts`                                                                    | 0 imports; the feature is two files (`careers-types.ts` + barrel), API routes import the file directly                                                               | same as above                                                             |
| `public/brand-mark.png` (**747 KB**, largest file in the repo)                                     | referenced only inside a comment in `features/marketing/components/sections/platform-intro.tsx:71`; the page uses `brand-mark-72.png`                                | delete                                                                    |
| `public/logo_white_bg.png` (128 KB)                                                                | 0 references (`logo_white_bg-96.png` is what every component uses)                                                                                                   | delete                                                                    |
| `calender.xlsx`, `deliverables.xlsx`, `deliverables-import-backup.json` (root, git-tracked, 62 KB) | 0 references; the JSON is a one-off import backup from 2026-09-10 naming client projects (business data); added in `4395343`, `61b115f`, `67f2a87`                   | remove from the repo (`git rm`), keep locally if needed                   |
| ~~`prisma/sql/*.sql` (3 files, June 2026)~~ **NOT dead - see §7**                                  | not referenced by any script - but they are the only DDL for `leave_policies`, `job_roles`, `AccrualMethod` and `LeaveApprovalStage`                                 | **keep**                                                                  |
| `tsconfig.check.tsbuildinfo` (994 KB, untracked)                                                   | refers to a `tsconfig.check.json` that no longer exists                                                                                                              | delete locally                                                            |

knip also lists `public/sw.js`, `public/theme-boot.js`, `prisma/schema.prisma` and the
`prisma/*.ts` maintenance scripts as "unused" - those are **false positives** (loaded by URL,
Prisma, or run with `npx tsx` as documented in `docs/multi-tenancy-progress.md`). A `knip.json`
that ignores `public/**`, `prisma/**` and `components/ui/**` would make the tool usable in CI.

> **`prisma/sql/` was nearly deleted on this evidence and must not be.** Checking before
> removing showed the three files are the only record of DDL that `schema.prisma` depends on -
> see §7, which is a more serious finding than the dead code this table lists. "No code
> references it" is the wrong test for a file that is applied by hand against a database.

### 1.2 Dead exports

knip: **228 unused exports across 117 files** and **162 unused exported types across 83 files**.
Highest concentrations:

| File                                       | Unused        | Notes                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/clients/index.ts`                | 11 + 14 types | Barrel re-exports nobody imports (`ClientFormDialog`, `ClientCombobox`, `useClients`, `useClient`, `useClientActivity`, `clientKeys`, `clientHref`, the three schemas, `CLIENT_STATUSES`). The components are used _inside_ the feature; the public surface is just over-declared. |
| `components/ui/dropdown-menu.tsx`          | 9             | shadcn sub-components never used (`CheckboxItem`, `RadioItem`, `Shortcut`, `Group`, `Portal`, `Sub*`, `RadioGroup`) - normal for shadcn, safe to ignore                                                                                                                            |
| `server/tenants.ts`                        | 9 (+2 types)  | `RESERVED_SLUGS`, lookup helpers                                                                                                                                                                                                                                                   |
| `features/projects/lib/goal-derivation.ts` | 6 (+3 types)  |                                                                                                                                                                                                                                                                                    |
| `lib/constants.ts`                         | 5             | `ROLE_LABELS`, `REQUIREMENT_OPEN_STATUSES`, `APPLICANT_STAGE_COLORS`, `CONTENT_CALENDAR_STATUS_LABELS`, `CONTENT_CALENDAR_STATUS_COLORS`                                                                                                                                           |
| `features/payroll/payroll.ts`              | 4             | `PF_WAGE_CEILING`, `ESI_GROSS_LIMIT`, `computeStatutoryDeductions`, `STATUTORY_DEDUCTIONS_ENABLED` are exported but never imported - **verify whether statutory deductions are meant to be applied in payroll generation**                                                         |
| `lib/avatars.ts`                           | 4             | `AVATAR_EXT`, `AVATARS_PER_ROLE`, `AVATAR_COUNT`, `isPresetAvatar`                                                                                                                                                                                                                 |
| `lib/dates.ts`                             | 3             | `endOfDayUTC`, `monthRange`, `isWeekend`                                                                                                                                                                                                                                           |
| `server/auth.ts`                           | 3             | `authOptions`, `signIn`, `signOut`                                                                                                                                                                                                                                                 |
| `components/tenant-link.tsx`               | dup           | exports `Link` both named and as default                                                                                                                                                                                                                                           |

Also: `features/analytics` has no `index.ts` and its page imports the component file directly
(`app/(dashboard)/analytics/page.tsx:23`), and 30 cross-feature imports reach into another
feature's internals (`clients → projects` 3, `clients → admin` 3, `projects → seo` 2, `projects →
employees` 2, `noticeboard → admin` 2, `employees → admin` 2, …) - rule 2 of CLAUDE.md. An ESLint
`no-restricted-imports` pattern (`@/features/*/{components,hooks,server,lib,schemas}/*` from
outside that feature, with `app/api/**` exempt for `server/`) would stop the drift.

### 1.3 Lint-detected dead code and hygiene

- 68 `@typescript-eslint/no-unused-vars` warnings (e.g. `leaveTypeMap` in `prisma/seed.ts:1779`).
- 23 `console.log` calls in source, 53 `TODO/FIXME/HACK`, 45 `eslint-disable` comments, 3 `as any`.
- `README.md` is one line (`# DNMS`).

### 1.4 References to files that do not exist

- `package.json` → `"export:punches": "tsx scripts/export-hikvision-punches.ts"` - there is **no
  `scripts/` directory** in the working tree (0 tracked files; 20 historical commits touched it, and
  `.gitignore` still lists `/scripts/output/`).
- Docs reference eight scripts that are gone: `scripts/verify-tenant-guard.ts`,
  `verify-provisioning.ts`, `verify-tenant-urls.ts`, `verify-tenant-routing.ts`, `health-check.ts`,
  `build-favicon.ts` (`docs/identity-and-roles.md`, `docs/multi-tenancy-progress.md`),
  `fetch-avatars.ts`, `recrop-avatars.ts` (`docs/avatars.md`); `lib/tenant-url.ts:91` also cites
  `scripts/verify-tenant-urls.ts`.
- Either restore the verification scripts from history (`git log --all -- scripts`) - they are the
  documented proof of tenant isolation - or remove the script entry and fix the docs.

### 1.5 Config debris

- `next.config.mjs` → `typescript.ignoreBuildErrors: true`. `tsc` is clean today, so this only
  removes the safety net from `next build`. Set it to `false`.
- `package.json` → `"pnpm": { "onlyBuiltDependencies": [...] }` is ignored by pnpm 10 (it prints a
  warning on every command); `pnpm-workspace.yaml` `allowBuilds` already covers it. Delete the field.
- `postcss.config.mjs` JSDoc references `postcss-load-config`, which is not installed (knip
  "unlisted dependency"). Harmless - add it as a devDependency or drop the type comment.
- `CLAUDE.md` (560 lines) and `docs/dn-nextjs-standard.md` (357 lines) are two versions of the
  same standard with **787 differing lines**. Keep one; if both must exist, generate one from the other.

---

## 2. Packages installed but not used

Confirmed by three independent methods (knip, depcheck, grep for `from "<pkg>"` / `require("<pkg>")` / `import("<pkg>")`):

| Package                | Type          | Evidence                                                                                         |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `@auth/prisma-adapter` | dependency    | 0 imports. `server/auth.ts` uses JWT sessions with a credentials provider; no adapter is wired.  |
| `@hello-pangea/dnd`    | dependency    | 0 imports anywhere in `app/`, `features/`, `components/`, `lib/`, `hooks/`.                      |
| `@eslint/eslintrc`     | devDependency | `eslint.config.mjs` explicitly stopped using `FlatCompat` (the comment at the top explains why). |

```bash
pnpm remove @auth/prisma-adapter @hello-pangea/dnd @eslint/eslintrc
```

depcheck additionally reports `tailwindcss`, `@tailwindcss/postcss`, `postcss`,
`prettier-plugin-tailwindcss` and `tw-animate-css` - **all false positives** (used from
`postcss.config.mjs`, `app/globals.css` and `.prettierrc`). Everything else in `package.json` has
at least one import site (e.g. `dotenv` is used by `prisma.config.ts` and the Prisma scripts,
`docx`/`pptxgenjs`/`exceljs` by `deliverables-report.ts`, `xlsx` by two import dialogs and
`lib/export-xlsx.ts`, `mammoth`/`pdf-parse` by `lib/file-text.ts`, `googleapis` by
`lib/ga4.ts`/`gsc.ts`/`google-drive.ts`, `sharp` by the photo/logo routes).

---

## 3. Duplicate components and helpers

### 3.1 Components doing the same job twice

| Job                     | Shared implementation                                                 | Duplicate(s)                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status pill             | `components/shared/status-badge.tsx` `StatusBadge` (49 importers)     | `features/projects/components/goal-status.tsx` exports a second `StatusBadge`; `DeliverableStatusPill` (deliverable-history-dialog.tsx); local `StatusPill` in `my-progress.tsx:698`; 6 more files hand-roll `rounded-full bg-*-100` pills |
| KPI tile                | `components/shared/stat-card.tsx` `StatCard` (11 importers)           | local `StatCard` in `features/monitoring/components/project-monitoring-tab.tsx:231`; local `StatCardSkeleton` in `features/dashboard/components/admin-dashboard.tsx:57` although `loading-skeleton.tsx` exports one                        |
| Tab strip + count badge | `components/shared/tabs-bar.tsx` (19 importers)                       | `features/projects/components/project-tabs-bar.tsx` - both define an identical private `Badge({ count, className })` (lines 55 / 52)                                                                                                       |
| Date-range picker       | `components/shared/date-range-field.tsx` (`DateRangeValue` + presets) | `features/projects/components/date-range-picker.tsx` (`DayRange`, calendar-in-popover) - two react-day-picker range pickers with different value shapes                                                                                    |
| Tables                  | `DataTable` (40 files)                                                | 28 files render `<table>` by hand                                                                                                                                                                                                          |
| Form dialogs            | `FormDialog` (26 files)                                               | 44 files use `components/ui/dialog` directly (some legitimately - review case by case)                                                                                                                                                     |
| Route skeletons         | `loading-skeleton.tsx` (93 files)                                     | page-specific `MyTasksSheetSkeleton`, `MyTasksFullSkeleton`, `ProgressSkeleton`, `PayslipSkeleton` - acceptable, but they should compose the shared primitives                                                                             |

The July 2026 plan (`docs/ui-perf-refactor-plan.md`) named three "shadow" components
(`StatCard` in analytics, `StatusBadge` in kpi-profiles, `DateField` in employee-form). Those three
are gone; the monitoring `StatCard` and the projects `StatusBadge`/`Badge` above are what remain.

### 3.2 Helpers defined more than once

| Helper           | Definitions                                                                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatDate`     | `lib/utils.ts:9` (date-fns `dd/MM/yyyy`) **plus** three private `toLocaleDateString("en-IN")` copies: `features/employees/components/employee-salary-tab.tsx:22`, `features/projects/server/task-audit.ts:78`, `app/(dashboard)/payroll/salary-structures/page.tsx:27` (the salary-tab and salary-structures copies are byte-identical) |
| `formatBytes`    | `features/projects/components/resources-tab.tsx:61` and `features/storage/components/storage-account-views.tsx:47` - **different algorithms**, so the same size prints differently on two screens                                                                                                                                       |
| `formatDuration` | `features/attendance/hooks/use-sync-progress.ts:32` (ms), `features/project-mailer/lib/eta.ts:101` (s), `features/projects/components/task-timeline.tsx:69` (s) - three units/formats                                                                                                                                                   |
| `escapeHtml`     | `lib/email-layout.ts` and `features/projects/server/work-digest.service.ts`                                                                                                                                                                                                                                                             |
| `sleep`          | `lib/ai.ts` and `features/project-mailer/server/campaign-runner.ts`                                                                                                                                                                                                                                                                     |
| `chunk`          | `features/projects/server/deliverables-report.ts` and `features/projects/server/meta-sync.service.ts`                                                                                                                                                                                                                                   |
| `initials`       | `features/projects/components/project-logo.tsx` and `project-sheet.tsx`, while `lib/utils.ts` already exports `getInitials`                                                                                                                                                                                                             |

Same basename, different job (naming confusion rather than duplication - worth renaming):
`lib/activity.ts` (`recordActivity`, client-visible activity) vs
`features/projects/server/activity.ts` (`logActivity`, project activity log);
`features/projects/lib/project-teams.ts` (constants) vs `features/projects/server/project-teams.ts`
(seeding), each with its own `project-teams.test.ts`.

### 3.3 Two ways of fetching

121 call sites use the typed `apiFetch()` helper; **67 still call `fetch("/api/...")` directly**,
and 20 components fetch inside `useEffect` instead of TanStack Query (`features/admin/components/
email-template-form.tsx`, `role-form.tsx`, `features/chat/components/chat-view.tsx`,
`features/employees/components/employee-form.tsx`, `avatar-picker-dialog.tsx`,
`features/project-mailer/components/project-mailer-tab.tsx`, `features/projects/components/
messages-tab.tsx`, `project-form-dialog.tsx`, `project-logo-picker.tsx`, `app/(dashboard)/admin/
{audit-log,email-templates,roles}/page.tsx`, `app/(dashboard)/projects/my-tasks/page.tsx`,
`projects-client.tsx`, `app/(dashboard)/recruitment/page.tsx`, …). Those lose caching,
deduplication and the shared error/toast handling.

---

## 4. Performance bottlenecks

### 4.1 Client rendering model

- **49 of 95 pages are `"use client"`** - the entire route renders on the client and data is
  fetched after hydration (HTML → JS → fetch → render). The server-prefetch pattern that
  `app/(dashboard)/dashboard/page.tsx` demonstrates (`getQueryClient()` → `prefetchQuery` →
  `HydrationBoundary`) is used by **only 5 pages**. Extending it to the heavy lists (employee
  directory, attendance directory, my-tasks, projects list, recruitment, notifications) removes one
  full round trip from every first paint.
- **Project page code-splitting is likely defeated.** `app/(dashboard)/projects/[id]/page.tsx`
  (604 lines, client) declares 19 `dynamic()` tabs, but every one of them imports the same 60-line
  barrel: `dynamic(() => import("@/features/projects").then((m) => m.GoalsTab))`. A dynamic import
  of a barrel pulls the barrel's whole module graph into one chunk (`export *` of 23 components +
  6 hook files, including `project-sheet.tsx` 2,025 lines, `tasks-sheet-view.tsx` 2,199,
  `deliverables-tab.tsx` 1,913, `messages-tab.tsx` 1,682, `drive-tab.tsx` 1,615, `goals-tab.tsx`
  1,390). No production build was present (`.next` has no `BUILD_ID`), so this is inferred from the
  import graph rather than measured - run `ANALYZE=1 next build` to confirm. Fix that keeps the
  barrel rule: export lazy wrappers _from the feature_
  (`features/projects/components/lazy-tabs.ts` with `dynamic(() => import("./goals-tab"))`) and
  import those from the page. The same applies to `SeoTab`/`ProjectSitesCard` via
  `@/features/seo` and `ProjectMailerTab`, `ProjectMonitoringTab`, `ProjectClientsTab`.
- Landing page: `motion` is imported in 4 sections (`hero.tsx`, `hero-app-mockup.tsx`,
  `spotlight-client-portal.tsx`, `spotlight-payroll.tsx`); `LazyMotion` + `m` would cut most of
  its weight from the public bundle. `recharts` is imported by 12 client files (already in
  `optimizePackageImports`, and charts are `dynamic()` on the analytics and dashboard pages - good).
- `<script src="/theme-boot.js">` in `<head>` is render-blocking (lint `@next/next/no-sync-scripts`).
  It is deliberate (no theme flash) but can be inlined so it costs no extra request.
- `next/image` in 6 files vs raw `<img>` in 9 (user uploads / data URLs - acceptable;
  `portal-product-grid.tsx` and `project-logo.tsx` could use `next/image` with the existing B2
  `remotePatterns`).

### 4.2 Every route is dynamic, including the public site

`app/layout.tsx` calls `await auth()` to seed `<SessionProvider>`. Reading cookies in the root
layout makes **every route dynamic** - the marketing pages, legal pages and `/login` are rendered
per request and cannot be statically cached or served from a CDN. The marketing header only needs
the session for its "Go to app" link (`useSession()`), which `SessionProvider` can fetch lazily.
Move the server session read into `(dashboard)/layout.tsx`, `(portal)/layout.tsx` and
`platform/layout.tsx` (all three already call `tenantScopedSession()` / `getPlatformAdminSession()`)
and the marketing group becomes static.

### 4.3 Polling on top of SSE (the cheapest big win)

The app has server-sent-event streams (`/api/notifications/stream`, `/api/chat/stream`) **and**
keeps interval polling for the same data:

| Data              | Stream                        | Poller(s)                                                                                                                                                                                  |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Notifications     | `RealtimeNotifications` (SSE) | `realtime-notifications.tsx:139` 90 s (`/inbox?limit=8`), `hooks/use-unread-notifications.ts:31` 90 s (`/inbox?unread=true&limit=1`), `app/(dashboard)/notifications/page.tsx:93` **20 s** |
| Chat unread badge | `chat-view.tsx` (SSE)         | `hooks/use-unread-chat.ts:23` **20 s**                                                                                                                                                     |
| Project messages  | `messages-tab.tsx` (SSE)      | `use-projects.ts` `useProjectMessages` **15 s**, `useUnreadMessageCount` **15 s**, `useMessageReplies` **15 s**                                                                            |

With a project open that is ≥ 12 requests per minute per user for data the stream already
delivers; across a team it is the bulk of API traffic. Fix: on each SSE message call
`queryClient.invalidateQueries(...)` (already done in places) and drop `refetchInterval`, or keep a
slow fallback (≥ 5 min) only while `EventSource.readyState === CLOSED`. Also merge the two
notification pollers - they hit the same endpoint under different query keys.

Reasonable intervals that can stay: resignations 120 s, careers applications 60 s, attendance
push panel 60 s, monitoring 60 s, analytics 5 min.

### 4.4 React rendering (from lint)

- **72 `react-hooks/set-state-in-effect` errors in 72 files** - synchronous `setState` inside
  `useEffect`, which forces an immediate second render. They are concentrated in shared components
  every screen mounts: `confirm-dialog.tsx:56`, `delete-dialog.tsx:65`, `reject-reason-dialog.tsx:59`,
  `search-input.tsx:39`, `date-range-field.tsx:104`, `view-toggle.tsx:121`, `attachment-menu.tsx:188`,
  `attachment-preview.tsx:93,128`, `emoji-picker.tsx:170`, `media-viewer.tsx:70`,
  `message-cards.tsx:371`, plus pages such as `projects/my-tasks/page.tsx:133,283`,
  `performance/kpi-profiles/page.tsx:77,401`, `admin/{audit-log,email-templates,roles}/page.tsx`.
  Most are "reset local state when a prop changes" - the React docs pattern is to derive during
  render or key the component instead.
- 25 `react-hooks/exhaustive-deps` warnings (salary-structures 3, departments 2, designations 2,
  projects-client 2, …) - stale closures or effects that re-run more than intended.
- Also flagged: 4 `react-hooks/refs`, 3 `react-hooks/purity`, 3 `react-hooks/immutability`,
  2 `react-hooks/incompatible-library`.

### 4.5 Data layer

Healthy baseline: `select: {` appears 1,136 times vs `include: {` 122 (narrow reads are the norm),
315 indexes, the Prisma client `omit`s password hashes, the pg pool is sized (20 in production),
and the tenant guard scopes every query.

- **Prisma calls inside loops (26 sites)** - the ones worth fixing first:
  - `app/api/payroll/records/route.ts:412` `create` per row → `createMany`
  - `app/api/employees/[id]/roles/route.ts:74` `create` per role → `createMany`
  - `features/leave/server/leave-accrual.service.ts:429,435` `findMany` + `updateMany` per balance
  - `features/projects/server/task-status-periods.ts:156,169` parent + children lookup per task
  - `features/settings/server/settings.service.ts:59,75` `findUnique` + `upsert` per settings field → one `findMany` + `$transaction`
  - `features/tenants/server/platform.queries.ts:52` `count` per tenant → `groupBy`
  - `app/api/cron/evaluation-autocreate/route.ts:33`, `app/api/performance/evaluations/generate/route.ts:47` `findFirst` per employee → one `findMany` + a Set
  - `features/project-mailer/server/campaign-runner.ts:91,151`, `features/seo/server/seo.competitor.service.ts:164`, `seo.backlinks.service.ts:100`, `features/employees/server/employees.service.ts:185`, `features/monitoring/server/escalation.ts:75`, `uptime.service.ts:154`, `app/api/projects/route.ts:72`
    (The remaining sites are transactional creates where a loop is the intent.)
- **Unbounded reads**: ~263 `findMany` calls without `take` across 122 files (heuristic scan).
  Most are per-tenant reference lists, but directories that grow without bound (attendance logs,
  notifications, audit log, chat messages, employee/leave/payroll directories) should page
  server-side using the existing `lib/pagination.ts`.
- **Per-navigation DB read**: `(dashboard)/layout.tsx` and `(portal)/layout.tsx` re-read
  `isActive` on every page render (deliberate - instant lock-out for deactivated accounts). If it
  shows up in traces, a 30-60 s `unstable_cache` keyed by user id and invalidated on deactivation
  removes it without losing the guarantee in practice.
- **Report generation in the request**: `deliverables-report.ts` (2,574 lines) builds XLSX, DOCX
  and PPTX in-process inside the HTTP request. For large periods this will hit proxy timeouts;
  generate in the background and hand back a download link.
- **Email**: sends are fire-and-forget through `lib/queue.ts` (good). Seven direct
  `await sendEmail(...)` remain (3 API routes, 4 services) - confirm each is intentional.

### 4.6 Single-instance assumptions

`instrumentation.ts` starts six in-process schedulers on every Node server instance (task
reminders 60 s, campaign runner 30 s, uptime 5 min, renewals 1 h, SEO 1 h, work digest 1 h); the
rate limiter (`lib/rate-limit.ts`), the email "queue" and both SSE hubs are in-memory. This is
fine on one VPS process. A second instance (PM2 cluster, a blue/green deploy overlap) will run
every scheduled job twice (double campaign sends, double reminders) and split SSE audiences.
`DISABLE_INLINE_SCHEDULER` exists - document that exactly one instance may run without it, or rely
solely on the `/api/cron/*` endpoints.

### 4.7 Maintainability drag on the dev loop

19 files exceed 1,000 lines; the largest: `deliverables-report.ts` 2,574, `tasks-sheet-view.tsx`
2,199, `project-sheet.tsx` 2,025, `employee-form.tsx` 1,948, `deliverables-tab.tsx` 1,913,
`project-mailer-tab.tsx` 1,898, `messages-tab.tsx` 1,682, `drive-tab.tsx` 1,615,
`leave.service.ts` 1,503, `deliverables.service.ts` 1,471, `seo-tab.tsx` 1,431, `goals-tab.tsx`
1,390, `chat-view.tsx` 1,385, `use-projects.ts` 1,213 (dozens of hooks in one module). Type-check
is already run with an 8 GB heap (`--max-old-space-size=8192`). Splitting the tab components by panel
would also shrink the chunks in §4.1.

---

## 5. Optimisation plan (ordered by payoff ÷ effort)

**Same day**

1. `pnpm remove @auth/prisma-adapter @hello-pangea/dnd @eslint/eslintrc`; delete the `pnpm` field in `package.json`.
2. Delete the dead files/assets in §1.1 (`git rm` the three root data files, `brand-mark.png`, `logo_white_bg.png`, `ui/table.tsx`, the two project components, `prisma/sql/`).
3. Purge `prisma/snapshot.json` from the repo (§S1).
4. Remove `refetchInterval` where an SSE stream exists (§4.3) - three hooks, one page, one provider.
5. `typescript.ignoreBuildErrors: false`.
6. Fix or remove the `scripts/` references (§1.4).
7. `noindex` on gated layouts, fix robots rules and per-page canonicals (§6).

**This sprint** 8. Lazy tab wrappers inside `features/projects` (and seo / project-mailer / monitoring / client-portal) so each tab is its own chunk (§4.1); confirm with a bundle analysis. 9. Move `auth()` out of the root layout; make `(marketing)` static (§4.2). 10. Fix the `set-state-in-effect` cases in the 11 shared components first - every screen benefits (§4.4). 11. Server-prefetch + `HydrationBoundary` on the six heaviest list pages (§4.1). 12. `createMany` / `groupBy` / batched lookups for the loop sites in §4.5; add `take` + pagination to the growing directories. 13. Add `app/manifest.ts` (§6.3).

**Next** 14. Consolidate §3 duplicates: one `StatusBadge`, one `StatCard`, one tab `Badge`, one date-range picker, `formatDate`/`formatBytes`/`formatDuration`/`escapeHtml`/`sleep`/`chunk` in `lib/`. 15. Migrate the 67 raw `fetch("/api…")` sites and the 20 `useEffect` fetchers to `apiFetch` + TanStack Query. 16. Adopt `DataTable` / `FormDialog` in the 28 / 44 hand-rolled files (continuation of the July plan). 17. Add `knip` (with a config) and the `no-restricted-imports` barrel rule to `pnpm validate`; get `pnpm lint` to zero errors so `validate` is meaningful again. 18. Split the >1,500-line components; write a real README (or link the two docs).

---

## 6. SEO files

### 6.1 `app/robots.ts` - the disallow list never matches a real app URL

Pages in the authenticated app live at `/{tenantSlug}/…` (`proxy.ts` rewrites
`/digitallynext/dashboard` → `/dashboard` internally; un-prefixed links are _redirected_ to the
prefixed form). `robots.ts` disallows `/dashboard`, `/employees`, `/projects`, … - the internal
paths - so **none of the rules match the URLs a crawler can actually see**. In practice nothing
leaks (a crawler on an app URL is 307'd to `/login`, which _is_ disallowed), but the file gives
false assurance and `/login` itself is still crawlable-by-link.

Recommended shape:

```ts
rules: [
  {
    userAgent: "*",
    allow: ["/$", "/about", "/pricing", "/faq", "/contact", "/legal/", "/signup"],
    disallow: ["/"],
  },
]
```

plus an `X-Robots-Tag: noindex, nofollow` response header from `proxy.ts` for every path that is
not in `PUBLIC_PREFIXES` (belt and braces that works regardless of the URL scheme).

### 6.2 Metadata inheritance from the root layout

`app/layout.tsx` sets `robots: { index: true, follow: true }` and `alternates: { canonical: "/" }`.
Neither `(auth)/layout.tsx`, `(dashboard)/layout.tsx`, `(portal)/layout.tsx` nor
`platform/layout.tsx` export `metadata`, so every gated page inherits **index: true** and
**canonical: /**. Effects:

- `/signup` is in the sitemap at priority 0.9 but tells Google its canonical is the homepage - the
  two signals contradict each other. `/login` and `/select-workspace` do the same.
- Should a dashboard URL ever be reachable (a misconfigured proxy, a tenant-prefixed link in an
  email that a crawler follows while a session cookie is somehow present), it is marked indexable.

Fix: `export const metadata = { robots: { index: false, follow: false } }` in the four gated
layouts; give `/signup` (and `/login`) their own `alternates.canonical`; move the root
`canonical: "/"` to `(marketing)/page.tsx` where it belongs (the other marketing pages already set
their own).

### 6.3 No web app manifest

`public/sw.js` (web push), `public/apple-touch-icon.png` and `app/icon.png` exist, but there is no
`app/manifest.ts` / `site.webmanifest` and no `<meta name="theme-color">`. The app is therefore
not installable on Android/desktop and Lighthouse's installability and theme-color checks fail.
Add `app/manifest.ts` (name, short_name, `start_url: "/dashboard"`, `display: "standalone"`,
192/512 icons, theme/background colours matching `theme-boot.js`).

### 6.4 Smaller items

- `sitemap.ts` has no `lastModified` - add build or content dates so Google prioritises recrawls.
- `(marketing)/opengraph-image.tsx` covers marketing routes only; `/signup` and `/login` have no
  OG image (root layout defines none). Add `app/opengraph-image.tsx` or `openGraph.images` in root metadata.
- `siteConfig.url` falls back to `NEXTAUTH_URL` and then a hard-coded domain. Make sure
  `NEXT_PUBLIC_APP_URL` is set in production, or `metadataBase`, canonicals, OG URLs and the sitemap
  can end up on the auth URL.
- The marketing site is rendered dynamically (§4.2), which raises TTFB for crawlers and prevents
  CDN caching; making it static is also an SEO win.
- Legal pages reference placeholders in `config/site.ts` (`cin`, `gstin`, `contact.phone` are empty
  strings) - the config comments already say to fill them before relying on the legal pages.

What is already right: `metadataBase`, title template, description, keywords, OpenGraph + Twitter
cards, JSON-LD (`features/marketing/components/structured-data.tsx`), per-page `metadata` and
canonical on all 9 marketing pages, self-hosted fonts, `lang="en"`, `favicon.ico` + `app/icon.png`,
`robots.txt`/`sitemap.xml` explicitly allowed through the proxy, sitemap generated from
`LEGAL_INDEX` (slugs match the four legal pages).

---

## 7. Migration drift - `prisma/sql/` is load-bearing (found during cleanup)

Four objects that `prisma/schema.prisma` declares are created by **no migration at all**:

| Object                    | In `schema.prisma` | `CREATE` in `prisma/migrations/` | Only DDL                                               |
| ------------------------- | ------------------ | -------------------------------- | ------------------------------------------------------ |
| `leave_policies` table    | yes                | **none**                         | `prisma/sql/2026-06-leave-policy-accrual-approval.sql` |
| `AccrualMethod` enum      | yes                | **none**                         | same file                                              |
| `LeaveApprovalStage` enum | yes                | **none**                         | same file                                              |
| `job_roles` table         | yes                | **none**                         | `prisma/sql/2026-06-job-roles.sql`                     |

The header of the leave file explains how this happened: _"Apply against the live DB only (this DB
has no shadow-DB perms, so `prisma migrate dev` is not used here)."_ The change was applied by hand
to production and written into `schema.prisma`, but never became a migration.

**Consequence.** `prisma migrate deploy` against an empty database produces a schema missing a
table and two enums that the Prisma client expects. Any fresh environment - a new developer, CI, a
staging rebuild, a restored backup, **and tenant provisioning tested from scratch** - fails or
drifts. `pnpm setup` (`migrate dev && db:seed`) cannot currently reproduce the production schema.

**Fix.** Generate a real migration from the current schema and mark it applied on the live
database, so the two agree:

```bash
# On a scratch database, not production:
pnpm prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_reconcile_leave_policies_job_roles/migration.sql
# Then, against production, record it as already-applied (the objects are there):
pnpm prisma migrate resolve --applied <timestamp>_reconcile_leave_policies_job_roles
```

Verify with `pnpm prisma migrate diff --from-migrations prisma/migrations
--to-schema-datamodel prisma/schema.prisma --exit-code` - a clean exit means no drift left. Until
then `prisma/sql/` must stay in the repository: **it is the schema record, not leftovers.**

---

## S. Security findings noticed while auditing (not requested, but must not go unreported)

- **S1 - PII committed to git.** `prisma/snapshot.json` (203 KB, tracked) contains 11 `employees`
  rows with email, personal email, phone and date of birth, plus `salary_structures` and
  `payroll_records`, with real `@digitallynext.com` and `@gmail.com` addresses. It is in the
  history of every clone. Remove it from the index, add `prisma/snapshot.json` to `.gitignore`,
  write snapshots outside the repo, and - if the repository has ever been shared - rewrite history
  (`git filter-repo`) and rotate anything sensitive.
- `deliverables-import-backup.json` (root) names client projects and deliverables - business data
  that does not belong in the repo.
- `prisma/seed.ts` contains 28 phone-number-shaped strings; confirm they are fabricated.
- `.env` is untracked and ignored (good); `.env.example` is complete.

---

## Appendix - baseline outputs

- `pnpm type-check` → exit 0.
- `pnpm test` → 9 files, 282 tests, all passing.
- `pnpm lint` → 190 problems (93 errors, 97 warnings): `react-hooks/set-state-in-effect` 72,
  `@typescript-eslint/no-unused-vars` 68, `react-hooks/exhaustive-deps` 25,
  `react/no-unescaped-entities` 5, `react/use` 4, `react-hooks/refs` 4, `react-hooks/purity` 3,
  `react-hooks/immutability` 3, `@typescript-eslint/no-explicit-any` 3,
  `react-hooks/incompatible-library` 2, `@typescript-eslint/no-empty-object-type` 2,
  `@next/next/no-img-element` 2, `import/no-anonymous-default-export` 1, `@next/next/no-sync-scripts` 1.
- `knip` → 16 "unused files" (11 real, 5 false positives), 2 unused dependencies, 1 unused
  devDependency, 1 unlisted dependency, 228 unused exports, 162 unused exported types, 1 duplicate export.
- `depcheck` → 2 unused dependencies, 6 unused devDependencies (5 false positives).
- Loop/N+1 scan → 840 files, 26 sites; `findMany` without `take` ≈ 263 in 122 files;
  `select:` 1,136 vs `include:` 122.

---

## Cleanup log - what was actually changed

Carried out 2026-09-14, on top of commit `ddba72c`. Verified after every batch:
`pnpm type-check` exit 0, `pnpm test` 282/282 passing, `pnpm lint` unchanged at 190 problems
(no new ones introduced), and a full `NEXT_DIST_DIR=.next-verify pnpm build`.

### Packages (§2)

`pnpm remove @auth/prisma-adapter @hello-pangea/dnd @eslint/eslintrc` - 16 packages gone from the
lockfile. Re-checked for imports across every source extension first; none existed.

### Dead files (§1.1)

Deleted: `components/ui/table.tsx`, `features/projects/components/owed-deliverables-panel.tsx`,
`features/projects/components/weekly-hours-card.tsx` (each re-checked for dynamic/string
references immediately before removal), and the three stray root data files `calender.xlsx`,
`deliverables.xlsx`, `deliverables-import-backup.json`. Deleted locally:
`tsconfig.check.tsbuildinfo`.

**Moved, not deleted:** `public/brand-mark.png` (729 KB) and `public/logo_white_bg.png` (128 KB)
→ `assets/brand-masters/`. They have no importers, but they are the masters every derivative is
cut from - the deleted `scripts/build-favicon.ts` used `brand-mark.png` specifically. Out of
`public/` they are no longer served or deployed while remaining available for regeneration;
`assets/brand-masters/README.md` records what produces what.

**Kept:** `prisma/sql/*.sql` - see §7. This is the one item in the audit that was wrong.

**Not done:** `features/admin/index.ts` and `features/recruitment/index.ts` were listed as unused
barrels to delete or route through. `features/recruitment` is now **routed through** (4 imports of
`@/features/recruitment/careers-types` → `@/features/recruitment`); it is a types-and-constants
file, so the barrel costs nothing, and two of those importers were `features/careers` reaching into
another feature's internals - a rule-2 violation now fixed.

`features/admin` was deliberately **left alone**. Its barrel re-exports `RoleForm` and
`EmailTemplateForm` (two client components) alongside `use-permissions`, which 35 files import.
Routing those 35 through the barrel would pull both form components into every one of their chunks

- the CLAUDE.md rule would have made the bundle worse. Fixing this properly means splitting the
  barrel or narrowing what it exports, which is a design decision, not a cleanup.

### Config (§1.5)

- `next.config.mjs`: `typescript.ignoreBuildErrors` → `false`. The verification build exercises it.
- `package.json`: removed the `pnpm.onlyBuiltDependencies` field (ignored by pnpm 10+, warned on
  every command; `pnpm-workspace.yaml` `allowBuilds` already covers it) and the `export:punches`
  script, whose target `scripts/export-hikvision-punches.ts` does not exist. The script is
  recoverable with `git show 0473757^:scripts/export-hikvision-punches.ts` if it is still wanted.

### Polling beside SSE (§4.3)

Each change was made only after confirming which component holds the `EventSource` and which query
keys its handler invalidates.

| Hook / page                          | Before | After | Why                                                                                                         |
| ------------------------------------ | ------ | ----- | ----------------------------------------------------------------------------------------------------------- |
| `useProjectMessages`                 | 15 s   | none  | Sole caller `messages-tab.tsx` invalidates this key from its SSE handler                                    |
| `useMessageReplies`                  | 15 s   | none  | Same handler invalidates this key for the open thread                                                       |
| `useUnreadMessageCount`              | 15 s   | 60 s  | Read on the project page, where the Messages tab (and its stream) is usually **not** mounted - kept, slowed |
| `notifications/page.tsx`             | 20 s   | 120 s | `RealtimeNotifications` invalidates `["notifications"]`, which prefix-matches this key                      |
| `use-unread-chat`                    | 20 s   | 60 s  | Chat's stream only runs on the Chat screen; elsewhere this is the badge's only liveness - kept, slowed      |
| `use-unread-notifications`           | 90 s   | 90 s  | **unchanged** - its own comment already explains why 90 s is the aligned fallback cadence                   |
| `realtime-notifications` inbox-watch | 90 s   | 90 s  | **unchanged** - this _is_ the stream-down safety net                                                        |

With a project open, per-user background requests drop from roughly 12/min to 1/min.

### SEO (§6)

- **`app/robots.ts` rewritten as an allow-list.** The old disallow list named internal paths
  (`/dashboard`, `/projects`, …) that no crawler can reach, because signed-in pages live at
  `/{tenantSlug}/…`. It now denies `/` and allows only the homepage (`/$`), `/about`, `/contact`,
  `/pricing`, `/faq`, `/legal/` and `/signup`, so new tenants and new gated sections are private by
  default.
- **`noindex` on all four gated groups**: `(auth)`, `(dashboard)`, `(portal)` and `platform`
  layouts now export `robots: { index: false, follow: false }`, which they previously inherited
  from the root layout as `index: true`.
- **Canonical fixed.** Removed `alternates: { canonical: "/" }` from the root layout - it told
  search engines that every page without its own canonical was a duplicate of the homepage. All
  nine marketing pages already set their own. `/signup` now sets `canonical: "/signup"` and
  overrides the group's `noindex` back to indexable, since it is a conversion page the sitemap
  submits at priority 0.9.
- **`app/manifest.ts` added** with `public/icon-192.png` and `public/icon-512.png`, generated from
  the relocated master. Declared `purpose: "any"` only - the icons are contain-fitted to the full
  square, so claiming `maskable` would let Android crop into the mark.
- **`themeColor` added** as a `viewport` export (light `#ffffff` / dark `#0a0a0a`, matching
  `--background`).
- **`sitemap.ts`**: legal pages now carry a real `lastModified` taken from the revision date the
  documents themselves print. The other pages are deliberately left without one rather than stamped
  with a build timestamp, which would claim the whole site changed on every deploy.

### Security (§S1)

`prisma/snapshot.json` is `git rm --cached`'d and added to `.gitignore`; the local file is intact
so `pnpm db:restore` still works. **This does not remove it from history** - it is still in every
existing clone and in any remote. Purging it needs `git filter-repo` plus a force-push and
coordination with everyone holding a clone, which is destructive and was not done unilaterally.

### Deliberately not attempted in this pass

The bundle/prefetch work (§4.1), moving `auth()` out of the root layout (§4.2), the 72
`set-state-in-effect` fixes (§4.4), the N+1 batching (§4.5) and the duplicate consolidation (§3)
are all multi-file behavioural changes that need their own review and testing. `pnpm lint` still
reports 190 problems, exactly as before - nothing here fixed or added any.
