import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import {
  scoreEvaluation,
  isRatingComplete,
  type EvalCriterion,
} from "@/features/performance/evaluation"
import type { Session } from "next-auth"

const employeeSelect = {
  select: { id: true, firstName: true, lastName: true, employeeNo: true, profilePhoto: true },
}

type Viewer = "HR" | "MANAGER" | "CONTROLLER" | "EMPLOYEE" | null

function viewerRole(
  session: Session,
  ev: { employeeId: string; managerId: string | null; controllerId: string | null },
): Viewer {
  if (hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)) return "HR"
  if (ev.managerId === session.user.id) return "MANAGER"
  if (ev.controllerId === session.user.id) return "CONTROLLER"
  if (ev.employeeId === session.user.id) return "EMPLOYEE"
  return null
}

// GET - one evaluation. Participants only. An employee can't see the manager's
// ratings/score until the manager has actually submitted them.
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const ev = await db.evaluation.findUnique({
        where: { id },
        include: { employee: employeeSelect, manager: employeeSelect, controller: employeeSelect },
      })
      if (!ev) return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })

      const role = viewerRole(session, ev)
      if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      // The employee can't see reviewers' scores until each is submitted.
      let payload = ev
      if (role === "EMPLOYEE") {
        payload = {
          ...ev,
          ...(ev.managerSubmittedAt
            ? {}
            : { managerRatings: null, managerComment: null, finalScore: null }),
          ...(ev.controllerSubmittedAt ? {} : { controllerRatings: null, controllerComment: null }),
        }
      }

      return NextResponse.json({ data: payload, viewerRole: role })
    } catch (error) {
      console.error("[evaluations/[id]] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PATCH - submit one side's ratings. body: { role: "SELF"|"MANAGER", ratings, comment? }
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const ev = await db.evaluation.findUnique({ where: { id } })
      if (!ev) return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })

      const body = await req.json().catch(() => null)
      if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

      const { role, ratings, comment } = body as {
        role: "SELF" | "MANAGER" | "CONTROLLER"
        ratings: Record<string, number>
        comment?: string
      }
      if (role !== "SELF" && role !== "MANAGER" && role !== "CONTROLLER") {
        return NextResponse.json(
          { error: "role must be SELF, MANAGER or CONTROLLER" },
          { status: 400 },
        )
      }

      // Authorize the submission against the requested side.
      const isHr = hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)
      if (role === "SELF" && ev.employeeId !== session.user.id) {
        return NextResponse.json(
          { error: "Only the employee can submit the self-evaluation" },
          { status: 403 },
        )
      }
      if (role === "MANAGER" && ev.managerId !== session.user.id && !isHr) {
        return NextResponse.json(
          { error: "Only the assigned manager (or HR) can submit the manager review" },
          { status: 403 },
        )
      }
      if (role === "CONTROLLER" && ev.controllerId !== session.user.id && !isHr) {
        return NextResponse.json(
          { error: "Only the project controller (or HR) can submit the controller review" },
          { status: 403 },
        )
      }

      // Each side is scored against its own snapshotted criteria list.
      const managerCriteria = ev.managerCriteria as unknown as EvalCriterion[]
      const criteria =
        role === "SELF" ? (ev.selfCriteria as unknown as EvalCriterion[]) : managerCriteria
      if (!isRatingComplete(criteria, ratings)) {
        return NextResponse.json(
          { error: "Please rate every criterion (1–5) before submitting." },
          { status: 422 },
        )
      }

      const now = new Date()
      const data: Record<string, unknown> = {}
      if (role === "SELF") {
        data.selfRatings = ratings
        data.selfComment = comment?.trim() || null
        data.selfSubmittedAt = now
      } else if (role === "MANAGER") {
        data.managerRatings = ratings
        data.managerComment = comment?.trim() || null
        data.managerSubmittedAt = now
        data.finalScore = scoreEvaluation(managerCriteria, ratings).total
      } else {
        // CONTROLLER - recorded alongside; doesn't drive status or final score.
        data.controllerRatings = ratings
        data.controllerComment = comment?.trim() || null
        data.controllerSubmittedAt = now
      }

      // Status tracks the two core sides (self + manager); controller is supplementary.
      if (role !== "CONTROLLER") {
        const selfDone = role === "SELF" ? true : !!ev.selfSubmittedAt
        const managerDone = role === "MANAGER" ? true : !!ev.managerSubmittedAt
        data.status =
          selfDone && managerDone ? "COMPLETED" : selfDone ? "SELF_DONE" : "MANAGER_DONE"
      }

      const updated = await db.evaluation.update({
        where: { id },
        data,
        include: { employee: employeeSelect, manager: employeeSelect, controller: employeeSelect },
      })

      // Notify the other side / employee on the manager's verdict.
      if (role === "MANAGER" && ev.employeeId !== session.user.id) {
        await createNotification({
          employeeId: ev.employeeId,
          title: "Your performance review is ready",
          message: `Your manager review for ${ev.periodLabel} is complete (score ${updated.finalScore}/100).`,
          type: "info",
          link: `/performance/evaluations/${id}`,
        })
      } else if (role === "SELF" && ev.managerId && ev.managerId !== session.user.id) {
        await createNotification({
          employeeId: ev.managerId,
          title: "Self-evaluation submitted",
          message: `${updated.employee.firstName} submitted their self-evaluation for ${ev.periodLabel}.`,
          type: "info",
          link: `/performance/evaluations/${id}`,
        })
      }

      await createAuditLog(session, {
        action: `evaluation.submit.${role.toLowerCase()}`,
        module: "performance",
        entityType: "Evaluation",
        entityId: id,
        changes: { role, status: data.status },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[evaluations/[id]] PATCH error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE - remove an evaluation (HR only).
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      if (!hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const { id } = ctx.params
      await db.evaluation.delete({ where: { id } })
      await createAuditLog(session, {
        action: "evaluation.delete",
        module: "performance",
        entityType: "Evaluation",
        entityId: id,
      })
      return NextResponse.json({ data: { success: true } })
    } catch (error) {
      console.error("[evaluations/[id]] DELETE error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
