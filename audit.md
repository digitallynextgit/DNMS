# DNMS Codebase Audit

**Date:** 2026-08-22
**Scope:** All API routes (280), feature services, shared + feature components, auth/permission infra, Prisma schema.
**Focus:** Security holes, API correctness bugs, UI bugs/glitches, duplicated functionality (same behaviour built differently), and performance.

> **This is an audit only - no code was changed.** Every item below is a description of the defect and the recommended fix.

---

## Methodology

- A multi-agent sweep fanned out across five dimensions (security, API correctness, UI, duplication, performance), each reading the real files.
- Every finding was then put through an **adversarial verification pass** - a second reviewer opened the cited file and confirmed, refuted, or corrected it. 66 findings survived verification (several had their details or counts corrected in the process).
- The **critical finding and the top security items were additionally re-verified by hand** against the source (`prisma/seed.ts`, the password-vault route, the recruitment routes, and all 13 cron routes).

**Confidence note:** locations are cited as `path:line` (line numbers approximate). A handful of items are environment- or scale-conditional and are flagged as such in their entry.

---

## Executive summary

| Severity     | Count | Headline                                                                                                               |
| ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| **Critical** | 1     | Any employee can download every other employee's personal HR documents                                                 |
| **High**     | 11    | Cross-project password-vault disclosure; fail-open cron auth; open recruitment PII; unpaginated full-table reads       |
| **Medium**   | 35    | TOCTOU on leave/poll/reaction writes; half-day leave charging bug; N+1 query storms; ~13 duplicated components/helpers |
| **Low**      | 19    | Minor IDOR, timing, key/focus, and code-consistency issues                                                             |

**Distinct issues after merging duplicate reports:** ~57 (the password-vault, cron-auth, and chat-SSE issues were each reported from multiple angles and are consolidated here).

### Fix these first (in order)

1. **SEC-01 - Employee document BOLA (Critical).** Every staff member holds `document:read`, which unlocks _anyone's_ personal documents. One-line policy error, worst blast radius.
2. **SEC-02 - Project password vault is not project-scoped (High).** Any project member can reveal, overwrite, or delete _any other project's_ stored credentials by id.
3. **SEC-03 - Cron auth fails open (High).** Three cron routes run unauthenticated if `CRON_SECRET` is unset.
4. **SEC-04 - Recruitment endpoints open to all staff (High).** Candidate PII + create/edit/delete gated on `withSession`, not recruitment scopes.
5. **SEC-08 / SEC-05 - Company payroll totals exposed; password-reset unthrottled (High/Med).**

The security fixes are small and localized. The duplication and performance items are lower urgency but reduce a whole class of future drift and load.

---

## 1. Security

### SEC-01 · CRITICAL · Any employee can read/download any other employee's personal HR documents

**Where:** `features/documents/server/employee-documents.service.ts:16` (and `documents.service.ts` `getDocumentUrl` for `employeeId !== null`)
**What:** The read gate is `canRead = hasPermission(session, DOCUMENT_READ)` and only falls back to a self-check when `canRead` is false. But **`prisma/seed.ts:200` grants the base `employee` role `document:read`** (verified by hand), so _every_ staff account passes the gate for _any_ `employeeId`.
**Scenario:** Employee A calls `GET /api/employees/<B>/documents`, then `GET /api/employees/<B>/documents/<docId>?download=1`, and receives a presigned download URL for B's ID proof / contract / offer letter.
**Impact:** Company-wide exposure of the most sensitive personal HR files - a broad BOLA/PII breach.
**Fix:** Do **not** gate cross-employee document access on the directory-wide `document:read`. Use a privileged HR scope (`employee:read`, or a new `employee-document:read` **not** held by the base employee role) for the "read anyone" branch; keep the self-only fallback. Apply the same to `documents.service.getDocumentUrl` for records where `employeeId !== null`. (Alternatively, remove `document:read` from the base `employee` role - but confirm nothing legitimately relies on it first.)

### SEC-02 · HIGH · Project password vault is not scoped to the project (reveal + tamper + delete)

**Where:** `app/api/projects/[id]/passwords/[entryId]/route.ts` - GET:16, PATCH:31/37, DELETE:77/83 _(consolidates three reported findings)_
**What:** All three handlers load the entry with `findUnique({ where: { id: entryId } })` - **no `projectId` filter**. `withProjectAccess`/`withProjectManager` only prove access to the project in the URL, not that the entry belongs to it. For PATCH/DELETE the ownership check is `entry.createdById !== me && !isAdmin`, but `isAdmin = canManageProject(me, urlProjectId)` is computed against the _caller's_ project, so a manager of project A satisfies it for a project B entry.
**Scenario:** A member of project A who learns an `entryId` from project B calls `GET /api/projects/A/passwords/<B-entry-id>` → B's decrypted password is returned. A manager of A can `PATCH`/`DELETE` B's entry the same way.
**Impact:** Cross-project disclosure of decrypted stored credentials, and cross-project tampering/destruction of them.
**Fix:** In all three handlers, load with `findFirst({ where: { id: entryId, projectId: ctx.params.id } })` (the wrapper already resolved `ctx.params.id` to the real project id) and 404 on no match - mirroring the `resources/[fileId]` route, which correctly rejects on `projectId` mismatch.

### SEC-03 · HIGH · Three cron routes skip authentication entirely when `CRON_SECRET` is unset (fail-open)

**Where:** `app/api/cron/birthdays/route.ts:13`, `app/api/cron/attendance-sync/route.ts:20`, `app/api/cron/leave-accrual/route.ts:12` _(verified by hand across all 13 cron routes)_
**What:** These three use `const secret = process.env.CRON_SECRET; if (secret) { ...check Bearer... }` - when the env var is unset the entire check is **skipped** and the handler runs for anyone. The other 10 cron routes compare directly against `` `Bearer ${process.env.CRON_SECRET}` `` (which stays closed, though it then accepts the literal `Bearer undefined` when unset - see SEC-06). `CRON_SECRET` is **not** validated in `lib/env.ts`, so "unset" is a reachable state (fresh deploy, rotated-away var, non-Vercel host).
**Scenario:** With `CRON_SECRET` unset, anonymous `GET /api/cron/leave-accrual?year=2020` recomputes every active employee's accrued balance; `GET /api/cron/attendance-sync` rewrites attendance logs; `GET /api/cron/birthdays` fires company-wide notifications/emails.
**Impact:** State-mutating jobs callable by anyone on the internet whenever the secret is absent.
**Fix:** Fail **closed** - introduce one shared `assertCron(req)` helper that returns 401 when `CRON_SECRET` is missing _or_ the bearer doesn't match (constant-time), and call it from every cron route. See also DUP-02.

### SEC-04 · HIGH · Recruitment applicant & interview endpoints open to any staff

**Where:** `app/api/recruitment/applicants/route.ts:6`, `applicants/[id]/route.ts:49,104`, `interviews/route.ts:6,25`
**What:** GET/POST/PATCH/DELETE are wrapped in `withSession` (any signed-in staff), not `withAuth(RECRUITMENT_READ/WRITE)`. The sibling `resume/route.ts` and `offer/route.ts` _do_ use `RECRUITMENT_WRITE`, so this is an inconsistency, not a missing scope.
**Scenario:** An employee with no recruitment permission lists all applicants (names, emails, and ~1-year presigned resume URLs - see API-09), PATCHes an applicant to `HIRED` (which fires a candidate-facing stage email), and deletes applicants/interviews.
**Impact:** Candidate PII exposure to all staff + unauthorized create/edit/delete + spurious candidate emails.
**Fix:** Wrap reads in `withAuth(PERMISSIONS.RECRUITMENT_READ)` and mutations in `withAuth(PERMISSIONS.RECRUITMENT_WRITE)`.

### SEC-05 · MEDIUM · Password-reset request endpoint has no rate limiting

**Where:** `app/api/password/forgot/route.ts:6` → `auth.service.ts` `requestPasswordOtp`
**What:** `withErrorHandler` with no limiter; one DB lookup + one email per call, and the response distinguishes "No active employee account" from success. (OTP _verify_ is well protected: bcrypt, 5-attempt lock, 10-min TTL - this is specifically about unbounded sends + enumeration.)
**Scenario:** A loop over one email floods the victim's inbox and burns the shared `notifications` SMTP quota; a loop over a wordlist enumerates active accounts quickly.
**Impact:** Email bombing, SMTP-quota exhaustion, fast account enumeration.
**Fix:** Apply the same in-memory sliding-window limiter used by `app/api/public/careers/applications/route.ts` (per-IP **and** per-email), plus a minimum resend interval per account.

### SEC-06 · MEDIUM · Cron routes accept `Authorization: Bearer undefined` when the secret is unset; non-constant-time compare

**Where:** the 10 "direct compare" cron routes, e.g. `leave-rollover/route.ts:12`, `content-reminders/route.ts:23`, `seo-daily/route.ts:16`, `el-accrual/route.ts:12`
**What:** `` req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` `` becomes `!== 'Bearer undefined'` when unset, so a request carrying that literal header passes; also a non-constant-time comparison.
**Impact:** Env-conditional fail-open (narrower than SEC-03 since a header is required) + timing side-channel.
**Fix:** Same shared `assertCron` helper as SEC-03/DUP-02 (reject on missing secret, `timingSafeEqual`).

### SEC-07 · MEDIUM · Cross-project Google Drive file deletion

**Where:** `app/api/projects/[id]/drive/file/route.ts` DELETE → `project-drive.service.ts:146`
**What:** `withProjectManager` authorizes on the URL project, but `body.fileId` is passed straight to `trashDriveFile` with no check that the file lives under this project's Drive folder. The service account can see every project's folder.
**Scenario:** Manager of A sends `DELETE /api/projects/A/drive/file { fileId: <B's file> }` → B's file is trashed.
**Impact:** Cross-project availability loss (recoverable from Drive trash, hence Medium).
**Fix:** Resolve the project's folder via `ensureProjectFolder(ctx.params.id)` and verify the target's parent is that folder (or a DB-tracked resource with matching `projectId`) before trashing; 404 otherwise.

### SEC-08 · MEDIUM · Company-wide payroll totals exposed to every employee

**Where:** `app/api/payroll/summary/route.ts`
**What:** Gated only on `PAYROLL_READ`, which the base `employee` role holds (seed.ts), and applies **no** per-employee scoping - unlike `records/[id]` GET, which restricts non-`PAYROLL_WRITE` callers to their own row.
**Scenario:** Any employee calls `GET /api/payroll/summary?month=8&year=2026` and gets company `totalGross`/`totalNet`/`totalDeductions`/`employeeCount`/status breakdown.
**Impact:** Confidential company payroll spend exposed to all staff.
**Fix:** Gate the summary on `PAYROLL_WRITE` (HR only). `PAYROLL_READ` must not unlock company-wide aggregates.

### SEC-09 · LOW · Single attendance record readable by any staff member

**Where:** `app/api/attendance/[id]/route.ts:9`
**What:** GET is `withSession` with no self-or-permission check; PATCH/DELETE require `ATTENDANCE_WRITE`. Practical risk limited by the non-enumerable cuid id.
**Fix:** Gate GET with `withAuth(ATTENDANCE_READ)` plus a self-or-permission object-level check.

### SEC-10 · LOW · No self-review guard on floating-holiday approval

**Where:** `app/api/attendance/floating-holidays/requests/[id]/route.ts:43`
**What:** PATCH authorizes on `isHr || isManager` but never checks `reqRow.employeeId !== session.user.id`, so an HR-role holder (or someone set as their own manager) can approve their own request. Resignations explicitly block this.
**Fix:** Reject with 403 when `reqRow.employeeId === session.user.id`, matching `reviewResignation`.

### SEC-11 · LOW · SVG logos stored and served inline unmodified (stored XSS on the storage origin)

**Where:** `app/api/projects/[id]/logo/route.ts:11,128`
**What:** `IMAGE_TYPES` includes `image/svg+xml`; SVG bytes are stored as-is (bypassing sharp) and GET 302-redirects to a signed B2 URL with no `Content-Disposition`, so the SVG opens inline and any embedded script runs - on the **B2 origin**, not the app origin (so it can't read app cookies), which caps severity.
**Fix:** Sanitize SVG (strip `script`/`on*`) before storing, or force `Content-Disposition: attachment` for SVG, or rasterize/deny SVG logos.

### SEC-12 · LOW · Public careers **read** API uses non-constant-time key compare

**Where:** `app/api/public/careers/route.ts:30` (vs the applications route's `timingSafeEqual`)
**Fix:** Use the same constant-time `keyMatches` helper. See DUP-09.

---

## 2. API correctness bugs

> The password-vault tamper/delete bugs (originally filed as API bugs) are consolidated into **SEC-02** above.

### API-01 · MEDIUM · Leave decision is not re-checked inside its transaction (TOCTOU → balance corruption)

**Where:** `features/leave/server/leave.service.ts:1241` (same pattern in `wfh.service.ts` `updateWfhRequest`)
**What:** Status is checked _before_ the transaction; inside it, `leaveRequest.update({ where: { id } })` and `leaveBalance.upsert(pending: {decrement:1}, used: {increment:1})` run with no status condition.
**Scenario:** A PENDING request approved near-simultaneously by the manager and HR (both eligible under "first decision wins") → both pass the outer check, both apply the balance delta → `pending = -1`, `used = 2`.
**Fix:** Make it atomic: inside the tx do `leaveRequest.updateMany({ where: { id, status: 'PENDING' }, data: {...} })` and only apply the balance change when `count === 1`; otherwise abort as "already decided." Same for WFH.

### API-02 · MEDIUM · `applyLeave` accepts `isHalfDay` on a multi-day range → charges 0.5 days for the whole span

**Where:** `features/leave/server/leave.service.ts:981`
**What:** `let totalDays = isHalfDay ? 0.5 : countCalendarDays(start,end)` with no `start === end` validation. The POST route calls the service directly, so UI guards don't apply.
**Scenario:** `{ leaveTypeId: CL, startDate: 2026-03-02, endDate: 2026-03-06, isHalfDay: true }` → 5 days off, 0.5 charged.
**Fix:** In the service, reject `isHalfDay` unless `startDate === endDate` (or force a single-day range).

### API-03 · MEDIUM · Single-choice poll vote is not atomic (double vote)

**Where:** `server/message-cards.ts:250`
**What:** The `existing` check (toggle-same-option-off) is outside the transaction. For a _different_ option, the tx does `deleteMany` then `create` under READ COMMITTED, so two near-simultaneous votes each delete-nothing then insert different options. `@@unique([optionId, voterId])` doesn't catch it (different `optionId`s).
**Scenario:** Double-click A then B → user holds two options; counts exceed voter count.
**Fix:** Add a poll-scoped unique `(pollId, voterId)` for single-choice polls, or run at Serializable isolation, or re-check inside the tx.

### API-04 · MEDIUM · Task PATCH `parseFloat` on hours → NaN write 500s the whole update; client can overwrite measured `loggedHours`

**Where:** `app/api/tasks/[id]/route.ts:222`
**What:** `data.loggedHours = parseFloat(loggedHours)` (and `estimatedHours`) with no coercion/validation; `parseFloat('')` = NaN → Prisma rejects → 500, so a legitimate status change also fails. `loggedHours` is taken verbatim from the body though it's system-measured from `inProgressSince`.
**Fix:** Validate with `z.coerce.number().finite().nonnegative()` (422 on bad input); do **not** accept `loggedHours` from the client (or gate it behind a manager-only manual-adjust path).

### API-05 · MEDIUM · Project code (`DN#####`) generation races → 500 instead of next number

**Where:** `app/api/projects/route.ts:63`
**What:** `findFirst(orderBy code desc)` + compute + `create` with no `@unique` (P2002) handling. Two simultaneous creates compute the same code; the second 500s.
**Fix:** Generate inside a retry loop that catches P2002 and recomputes, or use a Postgres sequence/counter row in the same transaction.

### API-06 · MEDIUM · Checklist item PATCH/DELETE/GET ignore `taskId` and enforce no project access

**Where:** `app/api/tasks/[id]/checklist/[itemId]/route.ts:11` (and the checklist GET)
**What:** Handlers read only `itemId`, call `update`/`delete` with `withSession` and no item→project access check and no `item.taskId === params.id` check.
**Scenario:** Any signed-in staff toggles/deletes any task's checklist items regardless of membership.
**Fix:** Load the item→task→project, run the standard `canAccessProject` check, and verify `item.taskId === params.id` (404 on mismatch). Apply to the checklist/comments GET handlers too.

### API-07 · MEDIUM · Resume upload persists a 1-year signed URL that the signer clamps to 7 days

**Where:** `app/api/recruitment/applicants/[id]/resume/route.ts` (`getSignedUrl(objectKey, ONE_YEAR)` stored in `applicant.resumeUrl`; `lib/storage.ts:197` clamps to 7 days)
**What:** The stored URL 403s after 7 days and nothing re-signs; also a long-lived bearer URL to PII sits in the DB.
**Fix:** Store only `objectKey`; mint a short-lived signed URL on demand in a `RECRUITMENT_READ` endpoint.

### API-08 · MEDIUM · `requeueStuckSends` measures "stuck" from `createdAt`, not claim time → duplicate sends

**Where:** `features/project-mailer/server/campaign-runner.ts:239`
**What:** Filters `status: 'SENDING', createdAt < cutoff`. `ProjectCampaignSend` has no `updatedAt`/`claimedAt`, so a healthy in-flight send from a campaign queued >10 min ago can be flipped back to PENDING and re-sent (multi-instance), while a genuinely stuck recent row is requeued late.
**Fix:** Add a `claimedAt` (or `@updatedAt`) set when status flips to SENDING, and requeue on _that_ older than the cutoff.

### API-09 · MEDIUM · Monthly-quota windows built with local `new Date(y,m,d)` vs UTC-stored rows

**Where:** `features/wfh/server/wfh.service.ts:428` (same class in `leave.service.ts` CL/SHORT checks and `getWfhEligibility`)
**What:** `wfhDate` is `startOfDayUTC`, but `monthStart`/`monthEnd` are `new Date(getUTCFullYear, getUTCMonth[, +1], 0)` - **local** midnights. On IST, `monthEnd` = last-day 00:00 IST = previous-day 18:30 UTC, so the final calendar day's row (00:00Z) is `> monthEnd` and escapes `count: { lte: monthEnd }`.
**Scenario:** On IST, a 28-Feb WFH doesn't count toward February's cap; a second WFH that month is wrongly approved.
**Impact:** Monthly WFH/CL/SHORT caps under-count on the last day of the month. _(Conditional on server TZ ahead of UTC.)_
**Fix:** Build boundaries with `Date.UTC(...)` to match stored UTC-midnight dates.

### API-10 · LOW · Application status PATCH re-notifies the referrer on every write

**Where:** `app/api/recruitment/applications/[id]/route.ts:80`
**What:** `if (data.status !== undefined) notifyReferrerOfStage(...)` with no comparison to the stored status; `notifyReferrerOfStage` doesn't dedupe on transition. Editing `hrNotes` while re-sending the same status re-notifies.
**Fix:** Load the current application and only notify when the incoming status actually differs.

### API-11 · LOW · Chat SSE can leak a subscription + heartbeat if the client disconnects during subscribe

**Where:** `app/api/chat/stream/route.ts:45`
**What:** The abort cleanup is registered _after_ `await subscribeChat`; a disconnect during that await never triggers cleanup (abort is one-shot), leaking the subscriber callback and the 25s interval.
**Fix:** Register the abort handler around the await and re-check `req.signal.aborted` immediately after `subscribeChat` resolves; guard cleanup so it's safe before the heartbeat/unsubscribe exist.

### API-12 · LOW · Per-employee HR attendance calendar never invalidated after a manual punch correction

**Where:** `features/attendance/hooks/use-attendance.ts:404` - `useCreateAttendanceLog`/`useUpdateAttendanceLog`/`useDeleteAttendanceLog` omit the `employee-attendance-calendar` key from their invalidate lists.
**Scenario:** HR corrects A's punch then reopens A's calendar within the 30s `staleTime` → stale data.
**Fix:** Add `['employee-attendance-calendar']` to those three mutations' invalidate lists.

### API-13 · LOW · Emoji reaction toggle is a non-atomic read-then-write (rapid taps 500)

**Where:** `features/chat/server/chat.service.ts:720` (same shape in the project react route - see DUP-14)
**What:** `find` composite-unique → delete-by-id or create. Two concurrent same-emoji adds both see `null` and both create → P2002; two concurrent removes → P2025. `runAction` surfaces these as 500.
**Fix:** For add, `create`/`upsert` and ignore P2002; for remove, `deleteMany` on the composite key (0 rows is fine). Report state from the actual write.

---

## 3. UI bugs & glitches

### UI-01 · HIGH · Edit-Project form silently discards in-progress edits on any parent re-render

**Where:** `features/projects/components/project-form-dialog.tsx:80`
**What:** The reset effect `useEffect(() => { if (open) { setForm({ ...EMPTY_FORM, ...initial }); … } }, [open, initial])` depends on `initial`, but both callers pass it as an **inline object literal** (`projects/[id]/page.tsx:444`, `projects-client.tsx:393`), so `initial` is a new reference every render. The detail page runs `useUnreadMessageCount` with `refetchInterval: 15_000` + `refetchOnWindowFocus: true`, guaranteeing periodic re-renders while the dialog is open.
**Scenario:** Admin edits a project's description; within 15s the unread poll refetches (or they tab away and back) → the form resets to stored values mid-edit. Appears random because it's driven by background polling.
**Fix:** Fire the reset only on the open transition - depend on `open` alone (with a prev-open ref) or on the opened project id; or memoize `initial` in the callers; or remount via `key={projectId}`. (Create path is unaffected - no `initial`.)

### UI-02 · MEDIUM · Navigating away mid-recording silently uploads the partial voice note

**Where:** `components/shared/voice-recorder.tsx:80`
**What:** The unmount cleanup (`teardown`) stops the mic tracks but does **not** set `abortRef`. Stopping tracks can fire `MediaRecorder.onstop`, which - seeing `abortRef` false and chunks non-empty - calls `deliver()`/`onSend()` (uploads) and then `setState` after unmount.
**Fix:** Set `abortRef.current = true` before `teardown` (or detach `recorder.onstop` before stopping tracks) so a track-end `onstop` discards the clip; keep the explicit finish path as the only sender. _(Browser-dependent whether track-stop fires onstop; Chrome does.)_

### UI-03 · MEDIUM · Emoji picker in the composer clears all @mentions before send

**Where:** `components/shared/message-composer.tsx:103`
**What:** `EmojiPicker onPick` calls `onChange(value + emoji, [])`, overwriting the parent's `mentionIds` with `[]`. If the emoji is the last edit before Send, mentioned teammates get no notification.
**Fix:** Route emoji insertion through the mention pipeline so ids are recomputed from the new text (e.g. `MentionTextarea.insert(text)` using `liveMentionIds`), or at minimum preserve the current `mentionIds`; insert at the caret rather than appending.

### UI-04 · MEDIUM · Chat SSE stream torn down and reopened on every conversation switch

**Where:** `features/chat/components/chat-view.tsx:170` _(also filed as PERF-05)_
**What:** The stream effect deps are `[qc, activeId]`, but `activeId` is only used inside the handler for toast suppression. Every conversation open runs `es.close()` + reopen; events arriving in the reconnect gap are lost, so `['chat','conversations']`/`unread-count` aren't invalidated until the next action. Defeats the file's own "ONE EventSource" design.
**Fix:** Store `activeId` in a ref updated each render, read `activeIdRef.current` in the handler, and reduce deps to `[qc]`.

### UI-05 · MEDIUM · Camera stream can stay live if the dialog is closed during Retake

**Where:** `components/shared/attachment-menu.tsx:238`
**What:** `retake()` calls `getUserMedia().then(stream => streamRef.current = stream)` with no cancelled/closed guard, and `setFacing(f => f)` is a no-op that doesn't restart the `[open,facing]` effect. Closing during re-init runs `stop()` while `streamRef` is still null; the promise then assigns a live stream nothing stops → webcam light stays on.
**Fix:** Add a `cancelled` ref set on close/unmount and stop the freshly acquired stream if the dialog is no longer open before assigning; or restart via the existing `[open,facing]` effect.

### UI-06 · MEDIUM · Leave decision letter wiped when the rejection reason is edited

**Where:** `features/leave/components/leave-decision-dialog.tsx:137`
**What:** `composed` is a `useMemo` over `[request, isReject, firstName, reason]` and `useEffect(() => setBody(composed), [composed])` force-syncs the editable letter. The rejection template embeds `reason`, so every keystroke in the reason field recomputes `composed` and overwrites any manual edit or AI-polished body.
**Fix:** Seed `body` once on open (or on request/action change) with a dirty flag; only re-apply `composed` while the user hasn't edited/AI-polished. (This is the same "force-sync overwrites edits" shape as UI-01.)

### UI-07 · LOW · Meta campaigns table keyed by campaign name, not a stable id

**Where:** `features/projects/components/insights-tab.tsx:397` (`rowKey={(c) => c.name}`); `meta-sync.service.ts` `topCampaigns` returns no id.
**What:** Meta campaign names can duplicate within an account; re-sorting can make React reuse the wrong row's DOM/state.
**Fix:** Include the campaign id in `topCampaigns` and key on it; interim `${c.name}|${index}`.

### UI-08 · LOW · PollComposer uses array index as React key for removable option inputs

**Where:** `components/shared/message-cards.tsx:158`
**What:** `options.map((opt,i) => <div key={i}>)`; removing a middle option shifts indices → focus/caret/IME lands on the wrong option.
**Fix:** Store each option with a stable id and key by it.

---

## 4. Duplication (same behaviour, different code)

> The user specifically asked for these. Each is genuine divergence, not a shared component reused.

### DUP-01 · HIGH · Payroll PATCH recomputes gross/net with a formula that diverges from the generator

**Where:** `app/api/payroll/records/[id]/route.ts:112` vs the generator at `records/route.ts:335`
**What:** The generator includes `telephoneAllowance` in gross and **hard-zeros** statutory deductions ("company <20 employees"). The PATCH adjust branch **omits** `telephoneAllowance` and calls `computeStatutoryDeductions` (PF/ESI/TDS). Two hand-written formulas → any DRAFT payslip HR adjusts loses the telephone allowance and gains deductions the generator zeroed.
**Impact:** Materially wrong net pay on adjusted DRAFT payslips (DRAFT-only, `PAYROLL_PROCESS`-gated).
**Fix:** Extract one pure `computePayslip()` used by both the generator and the adjust branch; layer overtime/other-deductions on top.

### DUP-02 · HIGH · Cron auth hand-rolled in 13 routes, two divergent idioms with opposite fail semantics

**Where:** all of `app/api/cron/*` _(security impact is SEC-03/SEC-06)_
**Fix:** One shared `withCronAuth`/`assertCron(req)` (constant-time, rejects when the secret is unset), wrap all cron routes, delete the three `if (secret)` guards and the ten inline compares.

### DUP-03 · MEDIUM · ~20 raw `<Loader2 className="animate-spin">` spinners instead of the shared `Spinner` / `<Button loading>`

**Where:** `components/shared/spinner.tsx` exists (sized xs–xl, with a docstring saying it replaces exactly these hand-copied lines), yet raw `Loader2` appears across ~20 files (e.g. `attachment-preview.tsx:297`, `voice-recorder.tsx:295`).
**Fix:** Replace each with `<Spinner size=… />` (or `<Button loading>` inside buttons).

### DUP-04 · MEDIUM · Identical IST time formatter defined three times with divergent empty-value handling

**Where:** `formatTime()` `attendance-table.tsx:31` (`'-'`), `fmtTime()` `attendance-calendar.tsx:32` (`'--:--'`), `toLocalTime()` `manual-attendance-dialog.tsx:29` (`''`) - all wrap the same `toLocaleTimeString('en-GB', {hour12:false, timeZone:'Asia/Kolkata'})`.
**Fix:** One `formatTimeIST()` (or a time-only option on `formatDateTime`) in `lib/utils.ts` with one null policy; point all three at it.

### DUP-05 · MEDIUM · File-upload pipeline duplicated across 5+ routes with divergent caps and validation

**Where:** `resources/route.ts` (250MB), `brand/assets` (250MB), `drive` (250MB, **no** extension guard), `mailer/images` (10MB), recruitment resume - each re-implements formData extraction + validation + `ensureBucket`/`getObjectKey`/`uploadFile`. Two 413 messages are wrong (say "100MB" while the cap is 250MB). `ALLOWED_FILE_TYPES`/`MAX_FILE_SIZE` exist but only the documents service uses them.
**Fix:** One `readAndStoreUpload({ form, field, prefix, id, maxBytes, allowedTypes, blockedExtensions })` fed by `lib/constants` + per-route overrides; apply a uniform blocked-extension list; fix the wrong 413 messages.

### DUP-06 · MEDIUM · Employee "who" select shape re-inlined across many routes instead of `EMPLOYEE_SUMMARY_SELECT`

**Where:** `document-requests/route.ts:10` re-declares the exact 5-field shape; many project routes inline a **4-field** variant dropping `employeeNo`.
**Impact:** The embedded employee object differs between endpoints for no deliberate reason (a chip expecting `employeeNo` silently loses it on some payloads).
**Fix:** Use `EMPLOYEE_SUMMARY_SELECT` (spread for supersets); decide once whether nested refs include `employeeNo` (canonical says yes).

### DUP-07 · MEDIUM · Data tables hand-rolled with raw `<table>` instead of the shared `DataTable`

**Where:** `features/seo/components/keyword-backlog.tsx:186` and sibling SEO/admin screens, though `components/shared/data-table.tsx` renders the standard card+table (skeleton, S.No, selection, pagination) from a `columns` array.
**Fix:** Move to `<DataTable columns rows />` (custom cell renderers stay). _(Verify each cited file individually.)_

### DUP-08 · MEDIUM · Signed-file and SSE routes hand-roll the staff gate; `notifications/stream` diverged (no client rejection)

**Where:** `chat/attachments/.../file:22`, `gallery/photos/.../file:19`, `projects/message-attachments/.../file:24` share an identical `getSession + 401 + kind==='client' 403` block and the same 24h/12h constants; `chat/stream` rejects clients but `notifications/stream` does **not** - the same gate two ways, one weaker.
**Fix:** Run signed-file routes through `withSession` (its `normalize` passes redirects through) and lift TTL/cache + `getSignedUrl → redirect` into one helper; add a shared `sseResponse(session, subscribe)` and gate both streams via `withSession`.

### DUP-09 · MEDIUM · Public careers API-key check implemented two ways

**Where:** `public/careers/route.ts:30` (`!==`, no rate limit) vs `public/careers/applications/route.ts` (`timingSafeEqual` + limiter).
**Fix:** One `verifyApiKey(provided, expected)` (length check + `timingSafeEqual`, closed on unset) for both; reuse the applications limiter for the read route.

### DUP-10 · MEDIUM · Byte/file-size formatting reimplemented in 6 places

**Where:** `humanSize` (`message-attachments.tsx:41`, `attachment-preview.tsx:41`), `fmtBytes` (`storage-manager.tsx:38`, `drive-tab.tsx:77`), `formatBytes` (`storage-account-views.tsx:47`, `resources-tab.tsx:61`) - divergent GB/TB support and null handling; `lib/utils.ts formatFileSize` caps at MB.
**Fix:** Extend `formatFileSize` to GB/TB with one null/zero rule; replace the six copies.

### DUP-11 · MEDIUM · Native `<Input type="date">` used where the shared `DateField` is standard

**Where:** `employee-form.tsx` uses `DateField` at 945/1226 but a native `type="date"` at 1535 in the same form; also recruitment/performance/audit-log/attendance-filters.
**Impact:** Native controls render OS-locale format (`mm/dd/yyyy`) vs `DateField`'s `dd/MM/yyyy` - dates read differently per screen.
**Fix:** Use `DateField`/`DateRangeField` for all `yyyy-MM-dd` entry.

### DUP-12 · MEDIUM · Inconsistent API response envelopes (raw vs `ok()/fail()` vs `respond()`, plus a bespoke third shape)

**Where:** `public/careers/applications/route.ts` defines a local `fail` emitting `{ error: { code, message } }`; the sibling careers GET returns `{ error: 'Unauthorized' }` (plain string); cron routes return bare `{ error }`. None match the canonical `{ success:false, error:{code,message} }`.
**Fix:** Wrap cron/public routes in `withErrorHandler` and return `ok()`/`fail()` from `lib/api-response`; delete the local `fail` and raw `{ error }` strings.

### DUP-13 · MEDIUM · Per-conversation unread count duplicated with a divergent `hiddenFor` filter

**Where:** `app/api/chat/unread/route.ts:32` counts with `NOT: { hiddenFor: { has: me } }`; `listConversations` (`chat.service.ts:150`) counts the same thing **without** that filter → the nav badge and the chat-list badge disagree for a hidden-for-me message. (Both are also N+1 - see PERF-01/06.)
**Fix:** One batched unread-count helper with a single agreed definition, called from both.

### DUP-14 · LOW · Emoji-reaction toggle logic duplicated (chat service vs project react route)

**Where:** `chat.service.ts:720` and `app/api/projects/[id]/messages/[messageId]/react/route.ts` implement the same find→delete-or-create toggle with independent code over two near-identical models.
**Fix:** One `toggleReaction(...)` helper (mirroring `server/message-cards.ts`), each route keeping only its access check. (Fixing API-13's atomicity here fixes both.)

### DUP-15 · LOW · Client portal reimplements Previous/Next pagination instead of shared `Pagination`

**Where:** `features/client-portal/components/portal-product-grid.tsx:207` vs `components/shared/pagination.tsx`.
**Fix:** Use `<Pagination page totalPages total onPageChange itemLabel />`.

### DUP-16 · LOW · Colleague search picker duplicated (un-debounced vs debounced)

**Where:** `ContactComposer` (`message-cards.tsx:585`) binds a raw `<Input>` whose value is directly in the query key (one request per keystroke); `ForwardDialog` (`forward-dialog.tsx:103`) uses the shared debounced `SearchInput`.
**Fix:** Use `SearchInput` in `ContactComposer`, or extract one `ColleaguePicker`.

### DUP-17 · LOW · Inline `toLocaleDateString('en-GB', …)` duplicates `formatDate()`

**Where:** `longDate()` `employee-profile-dialog.tsx:62`, `announcements-board.tsx:192` vs `lib/utils.ts formatDate`.
**Fix:** Call `formatDate(iso, 'd MMMM yyyy')` / `'d MMM yyyy'`.

### DUP-18 · LOW · Currency formatting reimplemented in the portal

**Where:** `portal-product-grid.tsx:41` `money()` vs `lib/utils.ts formatCurrency` (INR/0-digit). The portal needs a variable currency the shared helper can't express - that's the real gap.
**Fix:** Generalize `formatCurrency` to accept a currency code + fraction option; have `money()` delegate.

### DUP-19 · LOW · Destructive confirm rebuilt from `AlertDialog` instead of shared `ConfirmDialog`

**Where:** `features/seo/components/seo-tab.tsx:375` (no loading state during the delete mutation) vs `components/shared/confirm-dialog.tsx` (spinner + optional delay).
**Fix:** Use `<ConfirmDialog variant="destructive" isLoading … />`.

### DUP-20 · LOW · `resources` POST re-implements membership (`isProjectParticipant`) instead of the project-access guards

**Where:** `app/api/projects/[id]/resources/route.ts` POST (`withSession` + local `isProjectParticipant`) while GET correctly uses `withProjectAccess`.
**Fix:** Route POST through `withProjectManager` (or `canAccessProject`/`canManageProject`) and delete `isProjectParticipant`.

---

## 5. Performance

### PERF-01 · HIGH · Chat unread badge poll runs one COUNT per conversation, per poll, per user

**Where:** `app/api/chat/unread/route.ts:26`
**What:** On every poll it awaits `markDelivered(me)` (write fan-out) then `Promise.all(parts.map(p => chatMessage.count(...)))` - one count per conversation. Polled app-wide on a timer.
**Scale:** 60 users × ~30 conversations, every 30s ≈ ~1,800 counts + ~60 delivery fan-outs per interval, just to render a digit.
**Fix:** One `groupBy` on `chatMessage` (by `conversationId`, `senderId != me`, `deletedAt null`) over the user's conversation ids, thresholded against each `lastReadAt` in JS (or one raw SQL join). Gate `markDelivered` so its writes don't run on a read-only badge poll. Share with `listConversations` (PERF-06) and the `hiddenFor` definition (DUP-13).

### PERF-02 · HIGH · `projects/performance` scans the whole `ProjectTask` table twice for admins

**Where:** `app/api/projects/performance/route.ts:51,207`
**What:** For an admin with no date filter `scopeWhere = {}`, so the main `findMany` pulls every task (with assignee+project) to bucket in JS, then a **second** `findMany` with `distinct: ['projectId']` runs over the same unfiltered set just to build the project-picker list.
**Fix:** Derive the picker list from `Project`/`ProjectTeam` (or a `groupBy` on `projectId`); push filters into the main query; prefer DB `groupBy`/aggregate for the buckets. _(Same double-scan reportedly in `performance/report/route.ts`.)_

### PERF-03 · HIGH · `GET /api/tasks` has no pagination and returns the entire `ProjectTask` table for admins / non-`mine` calls

**Where:** `app/api/tasks/route.ts:141`
**What:** `findMany` with no `take`/`skip`; when `mine !== 'true'` there's no `assigneeId` filter (returns every task), and `scope=all` for a `PROJECT_WRITE` admin expands to every active employee. Each row includes project, team, assignee, and requirement relations.
**Fix:** Add cursor/page-limit pagination, require a bounded scope, and reject/default the no-filter path.

### PERF-04 · MEDIUM · `GET project messages` loads every thread with no pagination and sorts in JS

**Where:** `app/api/projects/[id]/messages/route.ts:96`
**What:** `findMany({ where: { projectId }, include: { author, _count.replies, reactions(with employee), replies take:1 } })` with no `take`, then decorate + re-sort by `lastActivityAt` in JS.
**Fix:** Paginate; denormalise a `lastActivityAt` column on `ProjectMessage` (updated on reply) to order/page in SQL; avoid pulling all reactions for every thread in the list view.

### PERF-05 · MEDIUM · Chat EventSource reopened on every conversation switch → server SSE handlers churn

**Where:** `features/chat/components/chat-view.tsx:170` _(same root as UI-04)_
**Fix:** Depend only on `[qc]`; hold the current conversation id in a ref for the toast comparison.

### PERF-06 · MEDIUM · `listConversations` issues up to 100 unread-count queries per call

**Where:** `features/chat/server/chat.service.ts:147`
**What:** `findMany(take:100)` + `Promise.all(rows.map(r => chatMessage.count(...)))`.
**Fix:** One `groupBy` over the fetched conversation ids, apply each `lastReadAt` in memory; share the helper with PERF-01.

### PERF-07 · MEDIUM · `payroll/summary` fetches all matching records and sums in JS

**Where:** `app/api/payroll/summary/route.ts:19`
**What:** `month`/`year` optional, so a no-filter call pulls the entire payroll history to compute four totals + a status breakdown. `analytics/route.ts:68` already does this correctly with `aggregate`.
**Fix:** `payrollRecord.aggregate({ where, _sum:{…}, _count })` + `groupBy({ by:['status'], where, _count })`.

### PERF-08 · MEDIUM · Project detail tabs dynamic-imported from the full feature barrel → one giant chunk

**Where:** `app/(dashboard)/projects/[id]/page.tsx:57`
**What:** All 11 `dynamic()` calls use `import('@/features/projects').then(m => m.X)`. `index.ts` is an `export *` barrel of ~25 components (incl. every recharts consumer), all referenced, so none tree-shake and all 11 share one module specifier → webpack emits **one** async chunk (barrel + static deps) downloaded on the first tab opened.
**Fix:** Dynamic-import the concrete component modules (`import('@/features/projects/components/brand-tab')`), mirroring `admin-dashboard.tsx`; verify per-tab chunks via a production build.

### PERF-09 · MEDIUM · `getSeoRollup` runs one snapshot query per SEO property (N+1)

**Where:** `features/seo/server/seo.queries.ts:488`
**What:** Task counts are batched (two `groupBy`) but the loop then awaits `seoSnapshot.findMany({ where:{propertyId}, take:2 })` per property. Also hit by the Progress page (`getProjectProgress`).
**Fix:** One `findMany` for all `propertyId`s ordered by `periodEnd desc` (the `@@index([propertyId,periodEnd])` supports it), keep the first two per property in JS (or a window query).

### PERF-10 · LOW · `runMonthlyAccrual` re-fetches each employee (N+1)

**Where:** `features/leave/server/leave-accrual.service.ts:386` - selects `{id}` then `recomputeAccrued(e.id)` which re-runs `employee.findUnique`. `resyncLeaveBalances`/`rolloverYear` already load fields once and `applyUsedFloor` batches.
**Fix:** Select accrual fields up front and pass them into `recomputeAccrued` via an `opts.employee`; call `applyUsedFloor(ids, year)` once after the loop.

### PERF-11 · LOW · `MyProgress` statically imported on the progress route → recharts in the manager chunk

**Where:** `app/(dashboard)/projects/progress/page.tsx:27` imports `MyProgress` statically (it renders only under `if (!canManageProjects)`), while siblings are `next/dynamic`. `my-progress.tsx` imports recharts at module top.
**Fix:** Load `MyProgress` via `next/dynamic` so recharts loads only when that branch renders.

---

## Cross-cutting themes & recommended shared helpers

Several findings share a root cause. Introducing these once removes whole classes of the issues above:

1. **`assertCron(req)` / `withCronAuth`** - fixes SEC-03, SEC-06, DUP-02 (13 routes).
2. **Project-scoped entry loader** (`findFirst({ id, projectId })` + 404) - the pattern behind SEC-02; audit every `[id]/[entryId]`-style route for it (passwords confirmed; check drive SEC-07, checklist API-06).
3. **`readAndStoreUpload(...)`** - DUP-05, and a place to enforce content-type/size/extension uniformly (touches SEC-11 SVG handling).
4. **One unread-count helper (batched)** - PERF-01, PERF-06, DUP-13.
5. **"Seed body once, track dirty" pattern** for editable-letter dialogs - UI-01, UI-06 are the same force-sync-overwrites-edits bug.
6. **Stable-ref stream effect** (ref for `activeId`) - UI-04 / PERF-05.
7. **Atomic conditional writes** (`updateMany` with the state in the `where`, or upsert-ignore-P2002) - API-01, API-03, API-13.
8. **Reuse existing shared UI** - `Spinner` (DUP-03), `DataTable` (DUP-07), `DateField` (DUP-11), `Pagination` (DUP-15), `ConfirmDialog` (DUP-19), `SearchInput` (DUP-16), `formatFileSize`/`formatDate`/`formatCurrency` (DUP-10/17/18), `EMPLOYEE_SUMMARY_SELECT` (DUP-06), `ok()/fail()` envelope (DUP-12).

## Suggested remediation order

1. **Today:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-08 (small, high-impact security).
2. **This week:** SEC-05/06/07; API-01, API-02, API-04, API-06 (correctness with data-integrity or auth impact); PERF-01/02/03 (load).
3. **Backlog:** remaining Medium/Low API + UI bugs; the duplication cleanups (best done as the shared-helper introductions above, which also close several bugs).

---

_Audit produced from a verified multi-agent sweep; the Critical and top-severity security items were additionally confirmed by hand against the source. No source files were modified._

---

# Remediation status (2026-08-22)

Fixes were applied in priority order - **security → correctness → UI bugs → bounded performance/duplication**. Everything below compiles clean (`tsc --noEmit` passes) and is Prettier-formatted. No database migrations were run.

## ✅ Fixed (40 findings)

**Security - all 12:** SEC-01 (employee-doc read now gated on `employee:read`, not the base-role `document:read`; same for company docs), SEC-02 (password-vault GET/PATCH/DELETE now scoped to the resolved project id), SEC-03 + SEC-06 (new `server/cron-auth.ts` `assertCron` - fail-closed, constant-time - wired into all 13 cron routes), SEC-04 (recruitment applicants/interviews now `withAuth(RECRUITMENT_READ/WRITE)`), SEC-05 (password-reset rate limited per IP+email via new `lib/rate-limit.ts`), SEC-07 (drive delete verifies the file is in the project's folder), SEC-08 (payroll summary now `PAYROLL_WRITE`), SEC-09 (attendance GET self-or-`attendance:write`), SEC-10 (floating-holiday self-review blocked), SEC-11 (SVG logos served `Content-Disposition: attachment`), SEC-12 (careers read key now constant-time via new `lib/api-key.ts` + rate limited).

**API correctness - 11:** API-01 (leave **and** WFH decisions now claim the transition atomically with `updateMany … where status:PENDING`, so concurrent approvals can't double-apply the balance), API-02 (half-day rejected on a multi-day range), API-03 (single-choice poll vote runs Serializable + retry; multi tolerates P2002), API-04 (task hours validated, no NaN 500), API-05 (project-code create retries on the unique race), API-06 (checklist item PATCH/DELETE verify task+project access), API-09 (WFH monthly window uses UTC bounds), API-10 (referrer notified only on a real status change), API-11 (chat SSE cleans up if aborted during subscribe), API-12 (per-employee attendance calendar invalidated on punch edits), API-13 (chat + project reaction toggles idempotent, no double-tap 500).

**UI bugs - all 8:** UI-01 (project edit form resets only on open, not on every parent re-render), UI-02 (voice recorder discards the clip on unmount instead of uploading it), UI-03 (emoji insert preserves @mentions), UI-04 / PERF-05 (chat SSE subscribes once, reads activeId from a ref), UI-05 (camera Retake re-acquires through the guarded effect), UI-06 (leave-decision letter no longer wiped when the reason is edited), UI-07 (Meta campaigns table keyed by a composite; `DataTable.rowKey` now gets the index), UI-08 (poll options keyed by stable id).

**Performance - 5:** PERF-05 (see UI-04), PERF-07 (payroll summary via `aggregate`/`groupBy`), PERF-09 (SEO rollup snapshots in one query, top-2-per-property in JS), PERF-10 (monthly accrual passes preloaded employee fields, no per-employee refetch), PERF-11 (`MyProgress` dynamically imported from its concrete module).

**Duplication - 4 (+ shared helpers introduced):** DUP-02 (cron auth → `assertCron`), DUP-09 (API-key check → `verifyApiKey`), DUP-13 (chat-list unread count now applies the same `hiddenFor` filter as the nav badge), DUP-14 (reaction-toggle bug fixed on both surfaces). New reusable helpers now exist for future consolidation: `server/cron-auth.ts`, `lib/api-key.ts`, `lib/rate-limit.ts`.

## ⏳ Deferred - need a migration, tested SQL, a prod build, or a broad sweep (not safe to do blind)

**Need a Prisma migration (I did not run migrations):**

- **API-07** - durable resume links. `Applicant.resumeUrl` is dual-purpose (uploaded-file URL _or_ a pasted external link), so on-demand signing needs a separate `resumeKey` column to disambiguate; overloading the field would break the pasted-link path and the storage orphan-matcher.
- **API-08** - mailer requeue by claim time needs a `claimedAt`/`@updatedAt` column on `ProjectCampaignSend`.

**Need tested raw SQL / a load test (a wrong count or heavy scan would be a worse regression):**

- **PERF-01, PERF-06** - batch the per-conversation unread counts. Correct batching needs a windowed/lateral raw query (per-conversation `lastReadAt` cutoffs can't be expressed in one typed `groupBy`); the correctness half (DUP-13) is already done.

**Need a production bundle analysis or a paging contract change + client updates:**

- **PERF-02, PERF-03, PERF-04** - pagination / avoid full-table scans on `projects/performance`, `GET /api/tasks`, project-messages list (changes response shape; needs client updates and load verification).
- **PERF-08** - split the project-detail tab chunk (dynamic-import concrete modules instead of the `export *` barrel); confirm with a prod build.

**Mechanical multi-file consistency sweeps (low harm if left, real regression risk if rushed unseen) - the shared helpers/targets already exist:**

- **DUP-01** (extract one payslip-compute shared by the generator and the adjust branch - money math, needs care), DUP-03 (raw `Loader2` → `Spinner`, ~20 files), DUP-04 (three IST time formatters → one), DUP-05 (one upload helper across 5 routes; also fixes the wrong 413 messages), DUP-06 (`EMPLOYEE_SUMMARY_SELECT` across many routes), DUP-07 (raw tables → `DataTable`), DUP-08 (signed-file/SSE gate consolidation), DUP-10 (byte formatter ×6 → `formatFileSize`), DUP-11 (native date inputs → `DateField`), DUP-12 (response envelopes → `ok()/fail()`), DUP-15 (portal → shared `Pagination`), DUP-16 (ContactComposer → `SearchInput`), DUP-17 (inline date → `formatDate`), DUP-18 (portal currency → `formatCurrency`), DUP-19 (seo confirm → `ConfirmDialog`), DUP-20 (resources POST → project-access guard).

These are best done as reviewed batches - the two migrations together, the perf items with a load test, and the duplication sweeps one component-family at a time so each can be eyeballed.
