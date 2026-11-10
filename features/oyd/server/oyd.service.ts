import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { actorStampId } from "@/lib/audit"
import { managedBy } from "@/lib/reporting-line"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { ActionError, ok, runAction, type ActionResult } from "@/server/action-result"
import { flagActionSchema, raiseFlagSchema } from "../schemas/oyd.schema"
import {
  canRemoveFlag,
  canReviewFlag,
  canSeeFlag,
  confirmsAtOnce,
  isOydHrRoles,
  type OydViewer,
} from "../lib/oyd-rules"
import type {
  OydActor,
  OydCategory,
  OydFlagView,
  OydListResult,
  OydPerson,
  OydStatus,
} from "../types"
import {
  notifyFlagConfirmed,
  notifyFlagRaised,
  notifyFlagRejected,
  notifyFlagRemoved,
} from "./oyd-notify"

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const

const FLAG_SELECT = {
  id: true,
  employeeId: true,
  raisedById: true,
  reviewedById: true,
  category: true,
  note: true,
  status: true,
  level: true,
  reviewedAt: true,
  reviewNote: true,
  removedAt: true,
  removeReason: true,
  createdAt: true,
  employee: {
    select: { id: true, firstName: true, lastName: true, employeeNo: true, profilePhoto: true },
  },
  raisedBy: PERSON,
  reviewedBy: PERSON,
  removedBy: PERSON,
} as const

type Person = { id: string; firstName: string; lastName: string | null }
type FlagRow = {
  id: string
  employeeId: string
  raisedById: string | null
  reviewedById: string | null
  category: string
  note: string
  status: string
  level: number | null
  reviewedAt: Date | null
  reviewNote: string | null
  removedAt: Date | null
  removeReason: string | null
  createdAt: Date
  employee: {
    id: string
    firstName: string
    lastName: string | null
    employeeNo: string | null
    profilePhoto: string | null
  }
  raisedBy: Person | null
  reviewedBy: Person | null
  removedBy: Person | null
}

const actor = (p: Person | null): OydActor =>
  p
    ? { id: p.id, name: `${p.firstName} ${p.lastName ?? ""}`.trim() }
    : { id: null, name: "Management" }

function toView(r: FlagRow, v: OydViewer): OydFlagView {
  return {
    id: r.id,
    employee: r.employee,
    raisedBy: actor(r.raisedBy),
    category: r.category as OydCategory,
    note: r.note,
    status: r.status as OydStatus,
    level: r.level,
    reviewedBy: r.reviewedAt ? actor(r.reviewedBy) : null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewNote: r.reviewNote,
    removedBy: r.removedAt ? actor(r.removedBy) : null,
    removedAt: r.removedAt?.toISOString() ?? null,
    removeReason: r.removeReason,
    createdAt: r.createdAt.toISOString(),
    canReview: canReviewFlag(r, v),
    canRemove: canRemoveFlag(r, v),
  }
}

async function viewerOf(session: Session): Promise<OydViewer> {
  const reports = await db.employee.findMany({
    where: managedBy(session.user.id),
    select: { id: true },
  })
  return {
    id: session.user.id,
    isHr: isOydHrRoles(session.user.roles ?? []),
    managedIds: reports.map((r) => r.id),
  }
}

/** Everything the caller may see: all of it for HR, their reports' for a manager, their own. */
export async function listFlags(session: Session): Promise<ActionResult<OydListResult>> {
  return runAction(async () => {
    const v = await viewerOf(session)
    const rows = await db.oydFlag.findMany({
      where: v.isHr
        ? {}
        : {
            OR: [
              { employeeId: { in: [...v.managedIds] } },
              { raisedById: v.id },
              { employeeId: v.id, status: "CONFIRMED" },
            ],
          },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: FLAG_SELECT,
    })
    return ok({
      flags: rows.filter((r) => canSeeFlag(r, v)).map((r) => toView(r, v)),
      viewer: { id: v.id, isHr: v.isHr, managesAnyone: v.managedIds.length > 0 },
    })
  })
}

/** Who the caller can raise a flag on: every active colleague but themselves. */
export async function listFlaggablePeople(session: Session): Promise<ActionResult<OydPerson[]>> {
  return runAction(async () => {
    const v = await viewerOf(session)
    const people = await db.employee.findMany({
      where: { isActive: true, id: { not: v.id }, ...VISIBLE_EMPLOYEE_FILTER },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, profilePhoto: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })
    return ok(people.map((p) => ({ ...p, confirmsAtOnce: confirmsAtOnce(v, p.id) })))
  })
}

export async function raiseFlag(
  input: unknown,
  session: Session,
): Promise<ActionResult<OydFlagView>> {
  return runAction(async () => {
    const data = raiseFlagSchema.parse(input)
    const v = await viewerOf(session)
    if (data.employeeId === v.id) throw new ActionError("You can't raise a flag on yourself", 422)

    const target = await db.employee.findFirst({
      where: { id: data.employeeId, isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
      select: { id: true },
    })
    if (!target) throw new ActionError("That employee isn't active here", 404)

    const confirmNow = confirmsAtOnce(v, data.employeeId)
    const by = actorStampId(session)
    const row = await db.$transaction(async (tx) => {
      const level = confirmNow ? (await activeCountIn(tx, data.employeeId)) + 1 : null
      return tx.oydFlag.create({
        data: {
          employeeId: data.employeeId,
          raisedById: by,
          category: data.category,
          note: data.note,
          status: confirmNow ? "CONFIRMED" : "PENDING",
          level,
          reviewedById: confirmNow ? by : null,
          reviewedAt: confirmNow ? new Date() : null,
        },
        select: FLAG_SELECT,
      })
    })

    if (confirmNow) await notifyFlagConfirmed(row)
    else await notifyFlagRaised(row)
    return ok(toView(row, v))
  })
}

/** confirm / reject (HR or the Reporting Manager, pending flags) or remove (raiser, HR, admin). */
export async function actOnFlag(
  id: string,
  input: unknown,
  session: Session,
): Promise<ActionResult<OydFlagView>> {
  return runAction(async () => {
    const data = flagActionSchema.parse(input)
    const v = await viewerOf(session)
    const row = await db.oydFlag.findUnique({ where: { id }, select: FLAG_SELECT })
    if (!row || !canSeeFlag(row, v)) throw new ActionError("Flag not found", 404)
    const by = actorStampId(session)
    const note = data.note || null

    if (data.action === "remove") {
      if (!canRemoveFlag(row, v)) {
        throw new ActionError(
          row.removedAt
            ? "This flag was already removed"
            : "Only the person who raised it, HR or an admin can remove a flag",
          row.removedAt ? 409 : 403,
        )
      }
      const updated = await db.oydFlag.update({
        where: { id },
        data: { removedAt: new Date(), removedById: by, removeReason: note },
        select: FLAG_SELECT,
      })
      if (row.status === "CONFIRMED") {
        await notifyFlagRemoved(updated, actor(updated.removedBy).name)
      }
      return ok(toView(updated, v))
    }

    if (!canReviewFlag(row, v)) {
      throw new ActionError(
        row.status !== "PENDING" || row.removedAt
          ? "This flag has already been dealt with"
          : `Only HR or ${row.employee.firstName}'s Reporting Manager can confirm this flag`,
        row.status !== "PENDING" || row.removedAt ? 409 : 403,
      )
    }

    const confirm = data.action === "confirm"
    const updated = await db.$transaction(async (tx) => {
      const level = confirm ? (await activeCountIn(tx, row.employeeId)) + 1 : null
      // Conditional, so two reviewers clicking at once can't both decide it.
      const res = await tx.oydFlag.updateMany({
        where: { id, status: "PENDING", removedAt: null },
        data: {
          status: confirm ? "CONFIRMED" : "REJECTED",
          level,
          reviewedById: by,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      })
      if (res.count === 0) throw new ActionError("This flag has already been dealt with", 409)
      return tx.oydFlag.findUniqueOrThrow({ where: { id }, select: FLAG_SELECT })
    })

    if (confirm) await notifyFlagConfirmed(updated)
    else await notifyFlagRejected(updated, note ?? "")
    return ok(toView(updated, v))
  })
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]
const activeCountIn = (tx: Tx, employeeId: string) =>
  tx.oydFlag.count({ where: { employeeId, status: "CONFIRMED", removedAt: null } })
