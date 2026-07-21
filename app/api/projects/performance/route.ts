import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// GET /api/projects/performance
// Task-throughput performance for people and projects: how much is completed,
// and how much of it lands on time. Admins (project:write) see everything; anyone
// else sees the teams they manage, the projects they own, and their own tasks.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const where = isAdmin
        ? {}
        : {
            OR: [
              { team: { managerId: session.user.id } },
              { project: { ownerId: session.user.id } },
              { assigneeId: session.user.id },
            ],
          }

      const tasks = await db.projectTask.findMany({
        where,
        select: {
          status: true,
          dueDate: true,
          completedAt: true,
          assigneeId: true,
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          project: { select: { id: true, name: true, code: true } },
        },
      })

      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      // Current week window (Mon 00:00 → next Mon 00:00, UTC).
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setUTCHours(0, 0, 0, 0)
      weekStart.setUTCDate(weekStart.getUTCDate() - ((now.getUTCDay() + 6) % 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const inWeek = (d: Date | null) => !!d && d >= weekStart && d < weekEnd

      type Bucket = {
        assigned: number
        completed: number
        onTime: number
        late: number
        overdue: number
        inProgress: number
        onHold: number
        discarded: number
        dueThisWeek: number
        doneThisWeek: number
      }
      const zero = (): Bucket => ({
        assigned: 0,
        completed: 0,
        onTime: 0,
        late: 0,
        overdue: 0,
        inProgress: 0,
        onHold: 0,
        discarded: 0,
        dueThisWeek: 0,
        doneThisWeek: 0,
      })

      const summary = zero()
      const byEmp = new Map<string, { info: NonNullable<(typeof tasks)[number]["assignee"]>; b: Bucket }>()
      const byProj = new Map<string, { info: (typeof tasks)[number]["project"]; b: Bucket }>()

      const classify = (b: Bucket, t: (typeof tasks)[number]) => {
        b.assigned++
        const done = t.status === "DONE"
        if (done) {
          b.completed++
          let onTime = true
          if (t.dueDate && t.completedAt) {
            const dueEnd = new Date(t.dueDate)
            dueEnd.setUTCHours(23, 59, 59, 999)
            onTime = t.completedAt <= dueEnd
          }
          if (onTime) b.onTime++
          else b.late++
        } else if (t.status === "DISCARDED") {
          b.discarded++
        } else if (t.status === "ON_HOLD") {
          b.onHold++
        } else {
          if (t.status === "IN_PROGRESS") b.inProgress++
          if (t.dueDate && new Date(t.dueDate) < todayStart) b.overdue++
        }
      }

      for (const t of tasks) {
        classify(summary, t)
        if (t.assignee) {
          const e = byEmp.get(t.assignee.id) ?? { info: t.assignee, b: zero() }
          classify(e.b, t)
          byEmp.set(t.assignee.id, e)
        }
        if (t.project) {
          const p = byProj.get(t.project.id) ?? { info: t.project, b: zero() }
          classify(p.b, t)
          byProj.set(t.project.id, p)
        }
      }

      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)
      const withRates = (b: Bucket) => ({
        ...b,
        completionRate: pct(b.completed, b.assigned - b.discarded),
        onTimeRate: pct(b.onTime, b.completed),
      })

      const byEmployee = [...byEmp.values()]
        .map((e) => ({
          id: e.info.id,
          name: `${e.info.firstName} ${e.info.lastName}`.trim(),
          profilePhoto: e.info.profilePhoto,
          ...withRates(e.b),
        }))
        .sort((a, b) => b.completed - a.completed || (b.onTimeRate ?? -1) - (a.onTimeRate ?? -1))

      const byProject = [...byProj.values()]
        .filter((p) => p.info)
        .map((p) => ({
          id: p.info!.id,
          name: p.info!.name,
          code: p.info!.code,
          ...withRates(p.b),
        }))
        .sort((a, b) => b.assigned - a.assigned)

      return NextResponse.json({
        data: { summary: withRates(summary), byEmployee, byProject, scope: isAdmin ? "all" : "mine" },
      })
    } catch (error) {
      console.error("[projects/performance] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
