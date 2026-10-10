import type { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { SYSTEM_ROLES } from "@/lib/constants"
import { getPendingResignationCount } from "@/features/resignations/server/resignations.service"
import { resolveMobilePrincipal, runAsMobilePrincipal } from "@/server/mobile-auth"
import { ipThrottled, throttled } from "@/features/auth/server/mobile-auth-http"

// =============================================================================
// GET /api/mobile/v1/badges - every number the tab bar and the Inbox draw, in
// one request.
//
//   { notifications, chat, approvals: { leave, wfh, resignations,
//     floatingHolidays }, tasksDueToday }
//
// WHAT THIS REPLACES. On the web those six numbers come from four polls
// (/api/notifications/inbox?unread=true&limit=1, /api/chat/unread,
// /api/resignations/review/count, /api/dashboard/me) plus two SSE streams
// (/api/notifications/stream, /api/chat/stream), and the two inbox lists are
// fetched as ROWS and counted client-side. On a phone each of those is a radio
// wake-up, and this endpoint is polled every 60s (no push) or 300s (push
// delivering) by useBadges() (dnmsApp src/features/badges/index.ts). Six
// requests at that cadence is a battery bug, which is why this exists.
//
// COUNTS ONLY. Not one findMany of rows, not one include, nothing serialized:
// every line below is a COUNT, they all go out in a single Promise.all, and the
// response is six integers. The temptation on this file is to reach for the
// services that already answer these questions - getMyTeamLeaveRequests() and
// getWfhInbox() - but both of them SELECT a page of fully-included rows
// (employee + leaveType + approver, WFH_INCLUDE) only to be asked for
// `pagination.total`. That is the web's bargain, where the list is on screen
// anyway. Here nothing is on screen. So their QUALIFICATION LOGIC is reproduced
// and their reads are not; each count below names the source it mirrors, and if
// one of those rules changes, this file is wrong until it is changed too.
//
// THE RULE EVERY APPROVAL COUNT OBEYS: a caller who cannot approve that thing
// gets 0, never a 403 and never an error. On the web, "are you an approver?" is
// an answer the inbox endpoints return alongside the rows (`isManager`,
// `isApprover`, or - for floating holidays - nothing at all, inferred from
// getting rows while force-filtered). A badge has nowhere to put that flag, and
// it does not need one: every rule below collapses to a WHERE that simply
// matches no rows for a non-approver. hasApprovals() on the phone then reads
// "all four are 0" as "show no approvals section", which is the same answer.
//
// TENANT SCOPING: the whole body runs inside runAsMobilePrincipal(), which is
// runWithTenant + runAsDelegate (server/mobile-auth.ts:592-599). So every
// db.*.count() below is narrowed to the caller's company by the tenant guard
// ("count" is in its FILTERED set, server/tenant-guard.ts:33-41) and
// getPendingResignationCount()'s requireSession() resolves to this phone's
// delegated session. The ONE exception is the raw chat query - see its own note.
// =============================================================================

/** Prisma, AsyncLocalStorage and a $queryRaw. None of this can run on the Edge. */
export const runtime = "nodejs"

/** Six live counts for one person. Nothing here is cacheable for a moment. */
export const dynamic = "force-dynamic"

/**
 * "Am I HR?" - the same triple as wfh.service.ts:60,
 * app/api/attendance/floating-holidays/requests/route.ts:9 and the APP's own
 * copy (dnmsApp src/features/approvals/hooks.ts:47). Duplicated rather than
 * imported because every one of those is module-private; exporting one of them
 * and pointing the rest at it is a worthwhile change, but it is a change to
 * four feature modules and not to this route.
 *
 * Note this is a ROLE test, deliberately, and not `wfh:approve` - see the long
 * note on `wfh` below for why the distinction decides whether the badge agrees
 * with the queue it is counting.
 */
const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

/**
 * The statuses getMyDashboard() calls "open" MINUS ON_HOLD.
 *
 * Its openTasks query asks for TODO / IN_PROGRESS / IN_REVIEW / ON_HOLD and then
 * drops ON_HOLD from the due-today bucket, with the reason in its own comment:
 * "ON_HOLD isn't 'due today' either: its remaining hours live on a follow-up
 * task" (features/dashboard/server/dashboard.queries.ts). Pre-subtracting it
 * here is the same set in one fewer step. DONE, CANCELLED and DISCARDED were
 * never in it.
 */
const DUE_TODAY_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW"] as const

const WINDOW_MS = 60_000

/** Per IP, pre-auth. 600/min, loose for the reason ipThrottled() documents: one
 *  office of staff is one public IP, so this bucket is really per-company. */
const PER_IP_PER_MIN = 600

/**
 * Per session. The app polls at 60s or 300s, so 30/min is ~30x headroom over
 * ordinary use and still caps a runaway refetch loop. Keyed on the SESSION, not
 * the token: the token rotates every 15 minutes and a token-keyed bucket would
 * reset itself and limit nothing.
 */
const PER_SESSION_PER_MIN = 30

export type MobileBadges = {
  notifications: number
  chat: number
  approvals: {
    leave: number
    wfh: number
    resignations: number
    floatingHolidays: number
  }
  tasksDueToday: number
}

/**
 * Today as the pair of instants that bracket the SERVER-LOCAL calendar day,
 * expressed at UTC midnight. Both halves of that sentence are load-bearing.
 *
 * SERVER-LOCAL, because that is what getMyDashboard() does and this count has to
 * agree with the dashboard the same app shows two taps away. It builds
 * `todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())`
 * and compares each task's dueDate by LOCAL y/m/d. Nothing about that is
 * timezone-neutral - and the repo's own `todayUtc()` (lib/dates.ts, "the anchor
 * for every DATE-column comparison") is NOT the same thing: between 00:00 and
 * 05:30 IST it returns YESTERDAY, so using it here would quietly disagree with
 * the dashboard every night. DNMS runs in Asia/Kolkata; a server at or east of
 * UTC reproduces getMyDashboard() exactly. West of UTC it would not, because
 * there the dashboard reads a date column's UTC midnight as the PREVIOUS local
 * day - which is a bug in that reading, not a contract to copy, so this matches
 * the local calendar day rather than that off-by-one.
 *
 * UTC MIDNIGHT, because project_tasks.due_date is `@db.Date`. Prisma hands such
 * a column back as UTC midnight, and it serializes a DateTime FILTER on it by
 * truncating to the UTC date too. Verified against the live table: for a date
 * holding 13 tasks, UTC-midnight bounds counted 13 and the dashboard's own
 * `new Date(y, m, d)` local-midnight bounds counted 2 - because local midnight
 * IST is 18:30Z the day before, which truncates to YESTERDAY'S date. So the
 * local y/m/d below is correct and the Date.UTC() wrapper around it is correct,
 * and dropping either one silently counts the wrong day.
 */
function localDayBounds(): { start: Date; end: Date } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  // Date.UTC handles the month and year rollover on d + 1.
  return { start: new Date(Date.UTC(y, m, d)), end: new Date(Date.UTC(y, m, d + 1)) }
}

/**
 * Unread chat messages, as ONE scalar.
 *
 * The predicate is the /api/chat/unread one, character for character: archived
 * conversations excluded, my own messages excluded, deleted excluded, messages I
 * hid for myself excluded, and "unread" meaning created after my own
 * last_read_at (or never read). It is already duplicated between
 * app/api/chat/unread/route.ts and chat.service.ts:123, whose comment says "Same
 * filter as the /api/chat/unread badge so the list and the nav badge always
 * agree" - this is the third copy and it has to agree with both, or the phone's
 * tab badge and the phone's conversation list contradict each other.
 *
 * COUNT(*) rather than that route's GROUP BY + reduce: conversation_participants
 * is keyed (conversation_id, employee_id), so the join matches at most one `p`
 * row per message and cannot fan out - which makes the total row count exactly
 * the sum of its per-conversation counts. One number instead of one row per
 * conversation.
 *
 * NOT TENANT-GUARDED, and that is stated rather than overlooked: the guard's own
 * header says "$queryRaw / $executeRaw" are not covered (server/tenant-guard.ts:8).
 * What scopes this is `p.employee_id = ${me}` - a participant row for THIS
 * employee, whose id is a globally unique uuid - so the rows reachable are the
 * caller's own conversations and nobody else's, in any company. Every parameter
 * is interpolated by Prisma as a bind parameter, never as SQL.
 *
 * IT DOES NOT STAMP DELIVERY. The web route runs markDelivered(me) alongside its
 * count; this one must not. markDelivered is a findMany + findMany + updateMany
 * (chat.service.ts:571-594) and a WRITE, and firing it from a background badge
 * poll every 60s would tell every sender "delivered" for messages the user has
 * not been shown - plus it would make the cheapest endpoint on the surface the
 * one that writes most. The phone stamps delivery where the web does: on the
 * chat screens, through the dispatcher.
 */
async function unreadChat(me: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS "count"
    FROM chat_messages m
    JOIN conversation_participants p
      ON p.conversation_id = m.conversation_id AND p.employee_id = ${me}
    WHERE p.is_archived = false
      AND m.sender_id <> ${me}
      AND m.deleted_at IS NULL
      AND NOT (${me} = ANY(m.hidden_for))
      AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
  `
  return rows[0]?.count ?? 0
}

/**
 * The six counts, in one round of parallel queries. Must run inside
 * runAsMobilePrincipal() - see the banner.
 */
async function countBadges(session: Session, me: string): Promise<MobileBadges> {
  const isHr = (session.user.roles ?? []).some((r) => HR_ROLE_NAMES.includes(r))
  const { start, end } = localDayBounds()

  const [notifications, chat, leave, wfh, resignations, floatingHolidays, tasksDueToday] =
    await Promise.all([
      // ---------------------------------------------------------------------
      // NOTIFICATIONS. The badge shortcut inside /api/notifications/inbox
      // (`unread=true & limit=1` -> `{employeeId, isRead: false}`), which is
      // also what getMyDashboard() reports as notifications.unread. Served by
      // the @@index([employeeId, isRead]) that exists for exactly this query.
      // ---------------------------------------------------------------------
      db.notification.count({ where: { employeeId: me, isRead: false } }),

      unreadChat(me),

      // ---------------------------------------------------------------------
      // LEAVE. getMyTeamLeaveRequests() (features/leave/server/leave.service.ts:780)
      // qualifies by the REPORTING LINE and nothing else - its route's comment
      // is "Managers are found by reporting line - no permission required". It
      // reads `employee.managerId = me AND isActive = true`, returns
      // `isManager: false` with an empty page when there are none, and
      // otherwise filters leave_requests to those ids. The app asks it for
      // `?status=PENDING` (dnmsApp approvals.api.ts:66).
      //
      // Expressed as a relation filter instead of that service's two steps
      // (findMany the reports, then `employeeId: { in: ids }`): the set of rows
      // is identical, it is one query instead of two, and the no-reports case
      // falls out as 0 without a branch - which is the "not an approver gets 0"
      // rule, for free.
      // ---------------------------------------------------------------------
      db.leaveRequest.count({
        where: { status: "PENDING", employee: { managerId: me, isActive: true } },
      }),

      // ---------------------------------------------------------------------
      // WFH. getWfhInbox() (features/wfh/server/wfh.service.ts:693) has TWO
      // qualification rules and the choice between them is not cosmetic:
      //   scope "all"  -> an HR ROLE *or* the `wfh:approve` permission, and
      //                   then EVERY pending request in the company;
      //   scope "team" -> at least one active direct report, and then only
      //                   those reports' requests.
      //
      // This badge counts the "team" set unless the caller holds an HR ROLE -
      // the same choice, for the same reason, as the app's own queue
      // (dnmsApp src/features/approvals/hooks.ts:95, `isHr ? "all" : "team"`).
      // The reason is that the LIST gate and the DECISION gate disagree on this
      // feature: updateWfhRequest() accepts a decision only from an HR role or
      // the applicant's own reporting manager, where `wfh:approve` counts for
      // nothing - and the seeded `hr_employee` role holds `wfh:approve` while
      // not being in HR_ROLE_NAMES. Counting by the list gate would give that
      // role a badge of every pending request in the company, none of which
      // they can act on: a number that disagrees with the queue the badge is
      // pointing at, which is worse than no badge.
      //
      // So: HR gets the company-wide pending count, everyone else gets their
      // active direct reports', and someone with no reports gets 0.
      // ---------------------------------------------------------------------
      isHr
        ? db.wfhRequest.count({ where: { status: "PENDING" } })
        : db.wfhRequest.count({
            where: { status: "PENDING", employee: { managerId: me, isActive: true } },
          }),

      // ---------------------------------------------------------------------
      // RESIGNATIONS. The only one of the six that already exists as a pure
      // count, so it is CALLED rather than reproduced:
      // getPendingResignationCount() IS /api/resignations/review/count, it is
      // one db.resignation.count(), and its own comment reads "For the live
      // sidebar badge". Its gate is `resignation:approve` -> every PENDING row,
      // otherwise PENDING rows whose employee reports to me.
      //
      // It is the one call here that returns an ActionResult instead of
      // throwing, because runAction() funnels everything. Nothing it can funnel
      // is reachable here: there is no input to fail validation, and its 401/403
      // come from requireSession(), which cannot fail inside an already-resolved
      // staff principal. An unexpected throw is logged by runAction itself
      // (server/action-result.ts:51) before it answers 500 - so mapping a
      // non-ok result to 0 degrades a badge that is already logged elsewhere,
      // and never hides something silently.
      // ---------------------------------------------------------------------
      getPendingResignationCount().then((r) => (r.ok ? r.data.count : 0)),

      // ---------------------------------------------------------------------
      // FLOATING HOLIDAYS. app/api/attendance/floating-holidays/requests/route.ts:21-30,
      // which is the only one of the four with its rule written in the route
      // rather than a service: an HR ROLE sees every row, and EVERY other
      // caller is force-filtered to `employee: { managerId: session.user.id }`.
      // There is no isApprover flag on that endpoint at all - a non-HR caller
      // who gets rows IS a manager of the people in them, which is the same
      // inference the app documents (dnmsApp approvals.api.ts:266-271).
      //
      // Two details copied exactly because they differ from leave and WFH
      // above, and getting them "consistent" would make this count wrong:
      //   - NO `isActive: true` on the manager filter. That route does not
      //     have it, so a request from a since-deactivated report still shows
      //     in HR's and the manager's queue - and therefore still has to be in
      //     the badge, or the Inbox shows a card the badge denies.
      //   - PENDING is the status the app asks that endpoint for, and on this
      //     two-stage machine PENDING is also what a row a manager has already
      //     decided keeps (its managerDecision is written while status stays
      //     PENDING so HR can still override) - so those rows are correctly
      //     still counted for HR.
      // ---------------------------------------------------------------------
      db.floatingHolidaySelection.count({
        where: isHr ? { status: "PENDING" } : { status: "PENDING", employee: { managerId: me } },
      }),

      // ---------------------------------------------------------------------
      // TASKS DUE TODAY. getMyDashboard()'s work.counts.dueToday
      // (features/dashboard/server/dashboard.queries.ts): my open tasks whose
      // dueDate falls on today, excluding ON_HOLD.
      //
      // Its `sameDay(t.dueDate) && !isOverdue(t)` has a redundant half - a task
      // whose due date IS today cannot also be strictly before today - so the
      // predicate reduces to "assigned to me, open, not ON_HOLD, due today",
      // and that is a range query. See localDayBounds() for why the bounds are
      // local-calendar-day-at-UTC-midnight and why neither half of that is
      // optional.
      //
      // `lt: end`, never `lte`, so a task due tomorrow at UTC midnight is
      // tomorrow's.
      // ---------------------------------------------------------------------
      db.projectTask.count({
        where: {
          assigneeId: me,
          status: { in: [...DUE_TODAY_STATUSES] },
          dueDate: { gte: start, lt: end },
        },
      }),
    ])

  return {
    notifications,
    chat,
    approvals: { leave, wfh, resignations, floatingHolidays },
    tasksDueToday,
  }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Cheapest gate first, before the token lookup, so an anonymous flood costs no
  // database work at all.
  const flooding = ipThrottled(req, "badges", PER_IP_PER_MIN, WINDOW_MS)
  if (flooding) return flooding

  // Self-authenticating: "/api/mobile" is a PUBLIC_PREFIXES entry in proxy.ts,
  // so this call is the whole difference between these counts and an anonymous
  // GET of them. It also re-reads the membership and the permission set, so a
  // revoked session, a deactivated employee, a suspended tenant or an edited
  // role takes effect here on the very next poll.
  const principal = await resolveMobilePrincipal(req)
  if (!principal) {
    return fail("UNAUTHORIZED", "A valid DNMS mobile access token is required", 401)
  }

  // FENCED, unlike /api/mobile/v1/me and /api/mobile/v1/devices, and matching
  // the dispatcher's 403 exactly. The two unfenced routes answer with the
  // caller's own flag and an acknowledgement; these are counts of OTHER people's
  // leave, WFH and resignations, so they belong behind the same fence as every
  // other data path. It costs the app nothing: _layout.tsx redirects to
  // /change-password while the flag is set, which unmounts the tab bar that
  // useBadges() lives in, so nothing is polling this while it answers 403.
  if (principal.mustChangePassword) {
    return fail("PASSWORD_CHANGE_REQUIRED", "Change your DNMS password before using the app", 403)
  }

  const busy = throttled(
    `mobile:badges:session:${principal.sessionId}`,
    PER_SESSION_PER_MIN,
    WINDOW_MS,
  )
  if (busy) return busy

  // runWithTenant + runAsDelegate: every count inside is narrowed to this
  // company by the tenant guard, and requireSession() inside the resignations
  // service resolves to this phone.
  const badges = await runAsMobilePrincipal(principal, () =>
    countBadges(principal.session, principal.employeeId),
  )

  return ok(badges)
})
