# Server Actions Migration Plan

**Goal:** Replace the internal REST API (`app/api/**`) with Next.js **Server Actions**, then delete the converted routes. The data layer keeps using React Query - hooks call actions instead of `fetch()`.

**Status:** Plan for approval. No code changes yet.

---

## 1. Scope at a glance

| Metric                                    | Count                               |
| ----------------------------------------- | ----------------------------------- |
| Route files total                         | 96                                  |
| Routes that **stay** (external/HTTP-only) | 4                                   |
| Routes to **convert** to actions          | 92                                  |
| Client `fetch('/api/...')` call sites     | 122                                 |
| Files containing those fetches            | 39 (mostly **8 React Query hooks**) |

---

## 2. What STAYS as a route (do **not** convert)

These are not called by our own UI - they are HTTP endpoints by nature:

| Route                                 | Why it must stay                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth's required handler. Removing it breaks all login.                                                                           |
| `app/api/public/careers/route.ts`     | Public API the marketing site calls server-to-server (API key, custom cache headers). External callers can't invoke a server action. |
| `app/api/cron/birthdays/route.ts`     | Hit by a scheduler with `CRON_SECRET` bearer. Cron can't call an action.                                                             |
| `app/api/cron/el-accrual/route.ts`    | Same - scheduled job.                                                                                                                |

After migration, `app/api/` contains **only** `auth/`, `public/careers/`, and `cron/`.

### ⚠️ Verify before converting (possible machine endpoints)

- `app/api/attendance/devices/[id]/events/route.ts` - if a **Hikvision device or worker posts events here**, it's a machine webhook and must stay. **Action item: confirm who calls it.**
- `app/api/attendance/qr/scan/route.ts` - confirm it's only called from our authenticated UI (not a public scanner page).

---

## 3. Conventions (the pattern every conversion follows)

### 3.1 Folder layout

```
lib/
  actions/
    _guard.ts          # auth/permission helpers (NOT "use server")
    _result.ts         # ActionResult type + helpers
    departments.ts     # "use server" - one file per module
    employees.ts
    leave.ts
    ...
```

Each `lib/actions/<module>.ts` starts with `"use server"` and **exports only async functions** (a `"use server"` file can't export schemas/consts - those live in `lib/schemas/**`).

### 3.2 Auth & permissions

The existing primitives in `lib/permissions.ts` (`getSession`, `hasPermission`, `isSuperAdmin`) are framework-agnostic and reused as-is. New thin guards (in `lib/actions/_guard.ts`, plain module - callable only from server code):

```ts
export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) throw new ActionError("Unauthorized", 401)
  return s
}
export async function requirePermission(perm: string | string[]): Promise<Session> {
  const s = await requireSession()
  const perms = Array.isArray(perm) ? perm : [perm]
  if (!isSuperAdmin(s) && !perms.every((p) => s.user.permissions.includes(p)))
    throw new ActionError("Forbidden: insufficient permissions", 403)
  return s
}
```

### 3.3 Return shape - **return errors, don't throw them**

> **Critical:** In production, Next.js **redacts error messages thrown from server actions** (security). So user-facing errors (validation, "code already exists") must be **returned**, not thrown.

```ts
// lib/actions/_result.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown }
```

Actions catch internally and return `{ ok:false, error }`. Client hooks re-throw so React Query's existing `onError` toasts keep working unchanged:

```ts
// in a hook
mutationFn: async (body) => {
  const r = await createDepartment(body)
  if (!r.ok) throw new Error(r.error) // preserves current toast UX
  return r.data
}
```

### 3.4 Validation

Reuse the existing zod schemas verbatim (`safeParse`); on failure return `{ ok:false, error:"Validation failed", details }`.

### 3.5 Audit log IP / User-Agent

Routes read `req.headers`. Actions use `next/headers`:

```ts
import { headers } from "next/headers"
const h = await headers()
const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined
const ua = h.get("user-agent") ?? undefined
```

### 3.6 Query params → typed arguments

The 26 routes that read `searchParams` become actions with a typed `filters` argument (e.g. `getEmployees(filters: EmployeeFilters)`).

### 3.7 Files

- **Upload** (`documents/upload`, `attendance/import`): action accepts a `FormData` arg - `export async function uploadDocument(form: FormData)`. The client already builds `FormData`, so the call site barely changes.
- **"Download"** (`documents/[id]`, `projects/[id]/resources/[fileId]`): these already return a **signed URL as JSON**, not a binary stream → convert normally; the browser still downloads from the signed URL.

### 3.8 Cache revalidation

React Query invalidation in the hooks already refreshes client data, so it keeps working. Add `revalidatePath('/path')` **only** where a Server Component renders the mutated data (e.g. dashboard). Audited per module.

---

## 4. Before / after (pilot: Departments)

**Before** - `app/api/departments/route.ts` + `[id]/route.ts` (4 handlers).

**After** - `lib/actions/departments.ts`:

```ts
"use server"
import { db } from "@/lib/db"
import { requirePermission, requireSession } from "./_guard"
import { ok, fail, type ActionResult } from "./_result"
import { PERMISSIONS } from "@/lib/constants"
import { createDepartmentSchema } from "@/lib/schemas/department"

export async function getDepartments(): Promise<ActionResult<Department[]>> {
  await requireSession()
  const data = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      /*…*/
    },
  })
  return ok(data)
}

export async function createDepartment(input: unknown): Promise<ActionResult<Department>> {
  await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
  const parsed = createDepartmentSchema.safeParse(input)
  if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
  try {
    const dept = await db.department.create({
      data: {
        /*…*/
      },
    })
    return ok(dept)
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002")
      return fail("Department name or code already exists")
    return fail("Internal server error")
  }
}
// updateDepartment(id, input), deleteDepartment(id) …
```

**Client** - `hooks/use-employees.ts`, swap the fetch helpers:

```ts
// before: const res = await fetch("/api/departments"); …
// after:
import { getDepartments } from "@/lib/actions/departments"
async function fetchDepartments() {
  const r = await getDepartments()
  if (!r.ok) throw new Error(r.error)
  return { data: r.data } // keep same shape the hook returns
}
```

Then delete `app/api/departments/`.

---

## 5. Module breakdown & rollout order

Order is dependency- and risk-based: a small self-contained module first (pilot), shared data next, then the big feature modules, admin last.

| #         | Module                                 | Routes (→ `lib/actions/*.ts`)                                                                                                                                | Client to rewire                                                 | Notes                                                                                |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1 (pilot) | **Departments / Designations**         | departments, departments/[id], designations                                                                                                                  | `use-employees.ts`, employees/departments page, recruitment page | Smallest CRUD; locks the pattern                                                     |
| 2         | **Employees**                          | employees, employees/[id], …/activate, …/documents(+[docId]), org-chart                                                                                      | `use-employees.ts`                                               | Has FormData (employee docs), org-chart read                                         |
| 3         | **Documents**                          | documents/[id], documents/company, documents/upload                                                                                                          | `use-documents.ts`                                               | FormData upload + signed-URL "download"                                              |
| 4         | **Leave**                              | leave/balances, requests(+[id]), team, types(+[id])                                                                                                          | `use-leave.ts`                                                   | email side-effects on approve/reject                                                 |
| 5         | **WFH**                                | wfh/eligibility, requests(+[id])                                                                                                                             | `use-wfh.ts`                                                     | email side-effects                                                                   |
| 6         | **Attendance**                         | attendance(+[id]), me, summary, import, holidays(+[id]), gps-checkin, qr/generate, qr/scan, devices(+[id] sync/test/events)                                  | `use-attendance.ts`                                              | **Verify `devices/[id]/events` & `qr/scan` aren't machine/public** before converting |
| 7         | **Payroll**                            | payroll/me(+[id]), records(+[id]), salary-structures(+[id]), summary                                                                                         | `use-payroll.ts`                                                 | money - verify totals parity                                                         |
| 8         | **Projects**                           | projects(+[id]), activity, messages(+[messageId]), passwords(+[entryId]), resources(+[fileId]), tasks, teams(+ nested members/promote/tasks), project-phases | `use-projects.ts` + project components                           | Largest module; FormData resources, encrypted passwords                              |
| 9         | **Tasks**                              | tasks(+[id]), approve, reject, checklist(+[itemId]), comments(+[commentId])                                                                                  | `use-projects.ts` / task components                              |                                                                                      |
| 10        | **Performance**                        | performance/cycles, goals(+[id]), reviews(+[id])                                                                                                             | inline component fetches                                         |                                                                                      |
| 11        | **Recruitment**                        | recruitment/applicants(+[id]), interviews(+[id]), jobs(+[id]), jobs/generate                                                                                 | recruitment pages                                                | `jobs/generate` = AI generation (returns JSON)                                       |
| 12        | **Notifications / Profile / Password** | notifications/inbox, notifications/templates, profile, auth/forgot-password, auth/reset-password                                                             | navbar, profile, forgot/reset pages                              | forgot/reset actions must **not** require a session                                  |
| 13        | **Admin / Dashboard**                  | roles(+[id]), permissions, audit-log, dashboard/stats, analytics                                                                                             | `use-permissions.ts`, admin pages, dashboard                     | last; mostly reads                                                                   |

After a module's actions exist, its hooks/components are rewired, and it's verified, **its route files are deleted** in the same step.

---

## 6. Per-module "definition of done"

1. `lib/actions/<module>.ts` created; every old handler has an equivalent action (same auth/permission, same validation, same response data).
2. All client callers (hook + any inline component fetch) call the action; response shape unchanged so components don't change.
3. Old `app/api/<module>/**` route files deleted.
4. `npx tsc --noEmit` clean for touched files; `grep` shows no remaining `fetch('/api/<module>')`.
5. Manual smoke test of the module's primary screen (list, create, edit, delete) on the running dev server.

---

## 7. Risks & mitigations

- **Production error redaction** → use the **return-don't-throw** `ActionResult` pattern (§3.3). Single biggest correctness risk; baked into the convention.
- **Auth on actions** → actions run as POST to the page; `proxy.ts` still guards page access, and every action re-checks via `requireSession`/`requirePermission`. Logged-out flows (password reset) use session-free actions.
- **Large surface (92 routes)** → strictly module-by-module; each module is independently shippable and verifiable. App stays runnable throughout (converted modules use actions, not-yet-converted modules still use their routes).
- **React Query keys / optimistic updates** → unchanged; only the `queryFn`/`mutationFn` body swaps `fetch` → action call. Same return shapes.
- **Machine endpoints** (`devices/events`, `qr/scan`) → flagged for confirmation before touching (§2).
- **`careers` depends on DB only** → unaffected; it stays and keeps reading the same tables.

## 8. Out of scope / explicitly unchanged

- NextAuth, careers, cron routes (§2).
- `proxy.ts` (keeps protecting pages; `/api/auth` prefix still needed for NextAuth).
- Database schema, React Query setup, UI components' markup.

## 9. Rough effort

~13 modules. Pilot (Departments) first for sign-off, then ~1 module per focused pass. Each pass = create actions + rewire hook + delete routes + verify.

---

## 10. Approval checklist (please confirm)

- [ ] Folder = `lib/actions/<module>.ts` (vs co-located `app/.../_actions.ts`)?
- [ ] `ActionResult` return-shape convention OK?
- [ ] Who calls `attendance/devices/[id]/events` and `attendance/qr/scan`? (decides if they stay)
- [ ] Start with the **Departments** pilot?
