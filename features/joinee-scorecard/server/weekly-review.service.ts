import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { hasAnyPermission, hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { wrapEmail } from "@/lib/email-layout"
import { addDays, startOfDayUTC, todayUtc } from "@/lib/dates"
import { isManagerOf, managedBy } from "@/lib/reporting-line"
import { requirePermission, requireSession, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { dayStatus, isScore } from "../lib/scorecard"
import {
  DEFAULT_REVIEW_PARAMS,
  applyParamEdit,
  parseParams,
  parseReviewScores,
  weekIsOpen,
  weeklyReviewFridays,
  type ReviewParam,
} from "../lib/weekly-review"
import type { DueWeeklyReview, WeeklyReviewResponse } from "../types"
import { calendarFor } from "./joinee-calendar"

// Weekly reviews after the 15-day scorecard. The reporting manager (or HR) scores each Friday.

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const
const NOT_FOUND = "Weekly review not found"
const MAX_PARAMS = 30
const MAX_LABEL = 60
const MAX_COMMENT = 4000

type Session = Awaited<ReturnType<typeof requireSession>>

/** HR edits anyone's; either manager edits their own reports'; the joinee reads theirs. */
async function rightsFor(session: Session, employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      managerId: true,
      dottedManagerId: true,
      manager: PERSON,
    },
  })
  if (!employee) return null
  const hr = hasPermission(session, PERMISSIONS.ONBOARDING_WRITE)
  const hrRead = hr || hasAnyPermission(session, [PERMISSIONS.ONBOARDING_READ])
  const isManager = isManagerOf(employee, session.user.id)
  return {
    employee,
    canRead: hrRead || isManager || session.user.id === employeeId,
    canEdit: hr || isManager,
    canManage: hr,
  }
}

/** The company default, hidden ones included; the built-in list until HR first edits it. */
async function defaultParams(): Promise<ReviewParam[]> {
  const rows = await db.joineeWeeklyReviewParam.findMany({ orderBy: { displayOrder: "asc" } })
  if (rows.length === 0) return DEFAULT_REVIEW_PARAMS.map((p) => ({ ...p }))
  return rows.map((r) => ({ key: r.key, label: r.label, isActive: r.isActive }))
}

/** Where the review's Fridays count from: the scorecard's first day, else the joining date. */
async function reviewStart(employeeId: string): Promise<Date> {
  const [day1, employee] = await Promise.all([
    db.joineeScorecardDay.findFirst({
      where: { scorecard: { employeeId }, dayNumber: 1 },
      select: { date: true },
    }),
    db.employee.findUnique({ where: { id: employeeId }, select: { dateOfJoining: true } }),
  ])
  return day1?.date ?? employee?.dateOfJoining ?? todayUtc()
}

/** No permission check (callers decide). Returns the existing id rather than throwing. */
export async function startWeeklyReviewFor(
  employeeId: string,
  opts: { actorId?: string | null } = {},
): Promise<{ id: string; created: boolean } | null> {
  const existing = await db.joineeWeeklyReview.findUnique({
    where: { employeeId },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
  if (!employee) return null

  const [fridays, params] = await Promise.all([
    reviewStart(employeeId).then(weeklyReviewFridays),
    defaultParams(),
  ])
  // Top-level createMany, not a nested create: the tenant guard only stamps top-level writes.
  const id = await db.$transaction(async (tx) => {
    const review = await tx.joineeWeeklyReview.create({
      data: { employeeId, createdById: opts.actorId ?? null },
      select: { id: true },
    })
    await tx.joineeWeeklyReviewWeek.createMany({
      data: fridays.map((date, i) => ({
        reviewId: review.id,
        weekNumber: i + 1,
        date,
        // Each Friday keeps its own copy, so it can be changed alone.
        params: params as unknown as Prisma.InputJsonValue,
      })),
    })
    return review.id
  })
  return { id, created: true }
}

export async function getWeeklyReview(
  employeeId: string,
): Promise<ActionResult<WeeklyReviewResponse>> {
  return runAction<WeeklyReviewResponse>(async () => {
    const session = await requireSession()
    if (!employeeId) return fail("employeeId is required")
    const rights = await rightsFor(session, employeeId)
    if (!rights) return fail("Employee not found", undefined, 404)
    if (!rights.canRead) return fail("You can't see this weekly review", undefined, 403)
    const { employee } = rights
    const person = {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      manager: employee.manager,
    }

    const raw = await db.joineeWeeklyReview.findUnique({
      where: { employeeId },
      select: {
        id: true,
        employeeId: true,
        weeks: {
          orderBy: { weekNumber: "asc" },
          select: {
            weekNumber: true,
            date: true,
            params: true,
            scores: true,
            comment: true,
            reviewedAt: true,
            reviewedBy: PERSON,
          },
        },
      },
    })
    const base = { employee: person, canEdit: rights.canEdit, canManage: rights.canManage }
    if (!raw) {
      const planned = weeklyReviewFridays(await reviewStart(employeeId))
      return ok({ review: null, plannedFridays: planned.map((d) => d.toISOString()), ...base })
    }

    const first = raw.weeks[0]?.date
    const last = raw.weeks.at(-1)?.date
    const calendar =
      first && last
        ? await calendarFor(employeeId, first, last)
        : { holidays: new Map<string, string>(), leaves: [] }
    const weeks = raw.weeks.map((w) => {
      // A holiday or leave on the Friday is only a note: the week is still reviewed.
      const status = dayStatus(w.date, calendar.holidays, calendar.leaves)
      return {
        weekNumber: w.weekNumber,
        date: w.date.toISOString(),
        params: parseParams(w.params) ?? [],
        scores: parseReviewScores(w.scores),
        comment: w.comment,
        reviewedBy: w.reviewedBy,
        reviewedAt: w.reviewedAt?.toISOString() ?? null,
        note: status.off?.label ?? status.note,
      }
    })
    return ok({
      review: { id: raw.id, employeeId: raw.employeeId, weeks },
      plannedFridays: weeks.map((w) => w.date),
      ...base,
    })
  })
}

/** HR starts one by hand, e.g. for someone who joined before scorecards existed. */
export async function createWeeklyReview(input: {
  employeeId?: string
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    if (!input.employeeId) return fail("employeeId is required")
    const started = await startWeeklyReviewFor(input.employeeId, { actorId: session.user.id })
    if (!started) return fail("Employee not found", undefined, 404)
    if (!started.created) return fail("This employee already has a weekly review", undefined, 409)
    await createAuditLog(session, {
      action: "joinee_weekly_review.create",
      module: "onboarding",
      entityType: "JoineeWeeklyReview",
      entityId: started.id,
      changes: { employeeId: input.employeeId },
      ...(await getAuditMeta()),
    })
    return ok({ id: started.id })
  })
}

/** The review and one of its Fridays, with the caller's rights over it. */
async function findWeek(session: Session, reviewId: string, weekNumber: number) {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) return null
  const review = await db.joineeWeeklyReview.findUnique({
    where: { id: reviewId },
    select: { id: true, employeeId: true },
  })
  if (!review) return null
  const week = await db.joineeWeeklyReviewWeek.findFirst({
    where: { reviewId, weekNumber },
    select: { id: true, date: true, params: true, scores: true, comment: true, reviewedAt: true },
  })
  if (!week) return null
  const rights = await rightsFor(session, review.employeeId)
  return rights ? { review, week, rights } : null
}

/** Set (null clears) any of one Friday's scores, and/or its comment. */
export async function updateWeeklyReviewWeek(
  reviewId: string,
  weekNumber: number,
  input: { scores?: unknown; comment?: unknown },
): Promise<ActionResult<{ weekNumber: number }>> {
  return runAction(async () => {
    const session = await requireSession()
    const found = await findWeek(session, reviewId, weekNumber)
    if (!found) return fail(NOT_FOUND, undefined, 404)
    const { week, rights } = found
    if (!rights.canEdit)
      return fail("Only the reporting manager or HR can fill this in", undefined, 403)
    if (!weekIsOpen(week.date, todayUtc()))
      return fail("This Friday opens on the Monday of its week")

    const allowed = new Set((parseParams(week.params) ?? []).map((p) => p.key))
    const scores: Record<string, number> = { ...parseReviewScores(week.scores) }
    let changed = false
    if (input.scores !== undefined) {
      if (!input.scores || typeof input.scores !== "object" || Array.isArray(input.scores))
        return fail("scores is an object of parameter key to 1-5")
      for (const [key, v] of Object.entries(input.scores as Record<string, unknown>)) {
        if (!allowed.has(key)) continue
        if (v === null) delete scores[key]
        else if (isScore(v)) scores[key] = v
        else return fail("Scores are whole numbers from 1 to 5")
        changed = true
      }
    }
    let comment = week.comment
    if (input.comment !== undefined) {
      if (input.comment !== null && typeof input.comment !== "string")
        return fail("comment is text")
      const text = typeof input.comment === "string" ? input.comment.trim() : ""
      if (text.length > MAX_COMMENT) return fail(`Comments are at most ${MAX_COMMENT} characters`)
      comment = text || null
      changed = true
    }
    if (!changed) return fail("Nothing to update")

    const filled = Object.keys(scores).length > 0 || !!comment
    await db.joineeWeeklyReviewWeek.update({
      where: { id: week.id },
      data: {
        scores: scores as Prisma.InputJsonValue,
        comment,
        // Who reviewed it is who first filled it in; emptied again, it is due again.
        ...(filled && !week.reviewedAt
          ? { reviewedById: session.user.id, reviewedAt: new Date() }
          : {}),
        ...(!filled ? { reviewedById: null, reviewedAt: null } : {}),
      },
    })
    return ok({ weekNumber })
  })
}

type ParamItem = { key: string | null; label: string; isActive: boolean }

/** The editor's list, checked: a string is the reason it was refused. */
function parseParamItems(value: unknown): ParamItem[] | string {
  const raw = Array.isArray(value) ? value : null
  if (!raw || raw.length === 0) return "Send the parameter list"
  if (raw.length > MAX_PARAMS) return `At most ${MAX_PARAMS} parameters`
  const items: ParamItem[] = []
  for (const it of raw) {
    const o = (it ?? {}) as Record<string, unknown>
    const label = typeof o.label === "string" ? o.label.trim() : ""
    if (!label) return "Every parameter needs a name"
    if (label.length > MAX_LABEL) return `Names are at most ${MAX_LABEL} characters`
    items.push({
      key: typeof o.key === "string" && o.key.trim() ? o.key.trim() : null,
      label,
      isActive: o.isActive !== false,
    })
  }
  if (!items.some((i) => i.isActive)) return "Keep at least one parameter visible"
  return items
}

/** One Friday's parameters, for this joinee only. Rows left out are hidden, never deleted. */
export async function updateWeekParams(
  reviewId: string,
  weekNumber: number,
  input: { items?: unknown },
): Promise<ActionResult<{ params: ReviewParam[] }>> {
  return runAction(async () => {
    const session = await requireSession()
    const items = parseParamItems(input.items)
    if (typeof items === "string") return fail(items)
    const found = await findWeek(session, reviewId, weekNumber)
    if (!found) return fail(NOT_FOUND, undefined, 404)
    if (!found.rights.canEdit)
      return fail("Only the reporting manager or HR can change this", undefined, 403)

    const next = applyParamEdit(parseParams(found.week.params) ?? [], items)
    await db.joineeWeeklyReviewWeek.update({
      where: { id: found.week.id },
      data: { params: next as unknown as Prisma.InputJsonValue },
    })
    await createAuditLog(session, {
      action: "joinee_weekly_review.params",
      module: "onboarding",
      entityType: "JoineeWeeklyReview",
      entityId: reviewId,
      changes: {
        week: weekNumber,
        params: items.map((i) => `${i.label}${i.isActive ? "" : " (hidden)"}`),
      },
      ...(await getAuditMeta()),
    })
    return ok({ params: next })
  })
}

export async function getDefaultReviewParams(): Promise<ActionResult<{ params: ReviewParam[] }>> {
  return runAction(async () => {
    await requireSession()
    return ok({ params: await defaultParams() })
  })
}

/** The company default that new reviews start with; reviews already started keep their own. */
export async function updateDefaultReviewParams(input: {
  items?: unknown
}): Promise<ActionResult<{ params: ReviewParam[] }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    const items = parseParamItems(input.items)
    if (typeof items === "string") return fail(items)

    const next = applyParamEdit(await defaultParams(), items)
    await db.$transaction(async (tx) => {
      const existing = new Set(
        (await tx.joineeWeeklyReviewParam.findMany({ select: { key: true } })).map((r) => r.key),
      )
      for (const [i, p] of next.entries()) {
        const data = { label: p.label, displayOrder: i, isActive: p.isActive }
        if (existing.has(p.key)) {
          await tx.joineeWeeklyReviewParam.updateMany({ where: { key: p.key }, data })
        } else {
          await tx.joineeWeeklyReviewParam.create({ data: { key: p.key, ...data } })
        }
      }
    })
    await createAuditLog(session, {
      action: "joinee_weekly_review.default_params",
      module: "onboarding",
      entityType: "JoineeWeeklyReviewParam",
      entityId: "company",
      changes: { params: items.map((i) => `${i.label}${i.isActive ? "" : " (hidden)"}`) },
      ...(await getAuditMeta()),
    })
    return ok({ params: next })
  })
}

export async function deleteWeeklyReview(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)
    const res = await db.joineeWeeklyReview.deleteMany({ where: { id } })
    if (res.count === 0) return fail(NOT_FOUND, undefined, 404)
    await createAuditLog(session, {
      action: "joinee_weekly_review.delete",
      module: "onboarding",
      entityType: "JoineeWeeklyReview",
      entityId: id,
      ...(await getAuditMeta()),
    })
    return ok({ id })
  })
}

/** Fridays (up to today) the given manager's active reports still need reviewed. */
async function dueFor(managerId: string, today: Date) {
  return db.joineeWeeklyReviewWeek.findMany({
    where: {
      reviewedAt: null,
      date: { lte: today },
      review: { employee: { ...managedBy(managerId), isActive: true } },
    },
    orderBy: { date: "asc" },
    select: { weekNumber: true, date: true, review: { select: { employee: PERSON } } },
  })
}

/** For "Waiting on you": the reviews the signed-in reporting manager still has to fill in. */
export async function listMyDueWeeklyReviews(): Promise<ActionResult<DueWeeklyReview[]>> {
  return runAction(async () => {
    const session = await requireSession()
    const rows = await dueFor(session.user.id, todayUtc())
    return ok(
      rows.map((r) => ({
        employee: r.review.employee,
        weekNumber: r.weekNumber,
        date: r.date.toISOString(),
      })),
    )
  })
}

/** Badge count for "Waiting on you"; 0 rather than an error, so the badge never breaks. */
export async function countMyDueWeeklyReviews(): Promise<number> {
  try {
    const session = await requireSession()
    return await db.joineeWeeklyReviewWeek.count({
      where: {
        reviewedAt: null,
        date: { lte: todayUtc() },
        review: { employee: { ...managedBy(session.user.id), isActive: true } },
      },
    })
  } catch {
    return 0
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const fridayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/**
 * Friday: tell each reporting manager whose joinee's review is due today. Monday: remind them
 * again about last Friday's that are still empty, copying the joinee's HR SPOC. With no manager,
 * the SPOC is told both times. Each run is claimed per day, so it sends once.
 */
export async function runWeeklyReviewReminders(
  now: Date = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = startOfDayUTC(now)
  const weekday = today.getUTCDay()
  if (weekday !== 5 && weekday !== 1) return { sent: 0, skipped: true }
  const friday = weekday === 5 ? today : addDays(today, -3)
  const kind = weekday === 5 ? "weekly-review-friday" : "weekly-review-monday"

  // Claim the day BEFORE any work: a duplicate reminder is worse than a late one.
  try {
    await db.digestRun.create({ data: { kind, periodStart: today } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  const weeks = await db.joineeWeeklyReviewWeek.findMany({
    where: { date: friday, reviewedAt: null, review: { employee: { isActive: true } } },
    select: {
      weekNumber: true,
      review: {
        select: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              manager: { select: { id: true, firstName: true, email: true, isActive: true } },
              dottedManager: {
                select: { id: true, firstName: true, email: true, isActive: true },
              },
              joineeScorecard: {
                select: { hrSpoc: { select: { id: true, email: true, isActive: true } } },
              },
            },
          },
        },
      },
    },
  })

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ""
  let sent = 0
  for (const w of weeks) {
    const joinee = w.review.employee
    const name = `${joinee.firstName} ${joinee.lastName}`.trim()
    const link = `/weekly-reviews/${joinee.id}`
    // Either manager fills it in; the reporting one is addressed, the dotted-line one copied.
    const dotted = joinee.dottedManager?.isActive ? joinee.dottedManager : null
    const manager = joinee.manager?.isActive ? joinee.manager : dotted
    const spoc = joinee.joineeScorecard?.hrSpoc?.isActive ? joinee.joineeScorecard.hrSpoc : null
    const late = weekday === 1
    const title = late ? "Weekly review still due" : "Weekly review due today"
    const message = `${name} - week ${w.weekNumber} (${fridayLabel(friday)}). Score the week and add a comment.`

    const recipients = [manager?.id, dotted?.id, late || !manager ? spoc?.id : null].filter(
      (id, i, all): id is string => !!id && all.indexOf(id) === i,
    )
    for (const id of recipients) {
      await createNotification({
        employeeId: id,
        title,
        message,
        type: late ? "warning" : "info",
        link,
      })
      sent++
    }
    // The mail goes to whoever fills it in: the manager, else the SPOC.
    const to = manager ?? (spoc ? { ...spoc, firstName: "there" } : null)
    if (to?.email) {
      const url = `${base}${link}`
      const bodyHtml = `
        <p style="margin:0 0 16px; font-size:15px; color:#111827;">Hi ${escapeHtml(to.firstName)},</p>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;">
          ${late ? "Last Friday's" : "Today's"} weekly review for <strong style="color:#111827;">${escapeHtml(name)}</strong>
          (week ${w.weekNumber}, ${escapeHtml(fridayLabel(friday))}) ${late ? "is still empty" : "is due"}.
          It takes a minute: a 1-5 score for each parameter and a short comment.
        </p>
        <p style="margin:0 0 8px;"><a href="${url}" style="display:inline-block; padding:10px 18px; background:#111827; color:#ffffff; border-radius:4px; text-decoration:none; font-size:14px;">Open the weekly review</a></p>`
      addEmailJob({
        to: to.email,
        cc: [
          late && manager && spoc?.email ? spoc.email : null,
          dotted && dotted.id !== to.id ? dotted.email : null,
        ].filter((e): e is string => !!e),
        subject: `${title}: ${name}`,
        html: wrapEmail({ title, bodyHtml }),
        text: `${message}\n\n${url}`,
        profile: "notifications",
      })
    }
  }
  return { sent, skipped: false }
}
