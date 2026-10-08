import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Admins (project:write) see all; others see their managed teams, owned projects and own tasks.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const scopeWhere = isAdmin
        ? {}
        : {
            OR: [
              { team: { managerId: session.user.id } },
              { project: { ownerId: session.user.id } },
              { assigneeId: session.user.id },
            ],
          }

      // from/to (inclusive) scope to tasks DUE in the window, so undated tasks are out of a dated view.
      const { searchParams } = req.nextUrl
      const projectId = searchParams.get("projectId") ?? undefined
      const from = searchParams.get("from")
      const to = searchParams.get("to")

      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      // Current week window (Mon 00:00 → next Mon 00:00, UTC).
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setUTCHours(0, 0, 0, 0)
      weekStart.setUTCDate(weekStart.getUTCDate() - ((now.getUTCDay() + 6) % 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

      // Aggregated in the DB, grouped by (assignee, project): summary, byEmployee and byProject are cheap
      // roll-ups of the same result, and the NULL groups drop out of the per-employee/per-project ones.
      const scopeSql = isAdmin
        ? Prisma.sql`TRUE`
        : Prisma.sql`(tm.manager_id = ${session.user.id} OR p.owner_id = ${session.user.id} OR t.assignee_id = ${session.user.id})`
      const projectSql = projectId ? Prisma.sql`t.project_id = ${projectId}` : Prisma.sql`TRUE`
      const fromSql = from
        ? Prisma.sql`t.due_date >= ${new Date(`${from}T00:00:00.000Z`)}`
        : Prisma.sql`TRUE`
      const toSql = to
        ? Prisma.sql`t.due_date <= ${new Date(`${to}T23:59:59.999Z`)}`
        : Prisma.sql`TRUE`

      // Overdue = past its date and not finished (on hold still counts). CANCELLED is legacy, like DISCARDED.
      const CLOSED = Prisma.sql`(t.status IN ('DONE', 'DISCARDED', 'CANCELLED'))`
      // due_date is @db.Date (UTC midnight); a task due today has all of today.
      const LATE = Prisma.sql`(t.due_date IS NOT NULL AND t.due_date < ${todayStart})`
      const OVERDUE = Prisma.sql`(NOT ${CLOSED} AND ${LATE})`
      // End of the due day (23:59:59.999).
      const DUE_END = Prisma.sql`(t.due_date + INTERVAL '1 day' - INTERVAL '1 millisecond')`

      type GroupRow = {
        assignee_id: string | null
        project_id: string | null
        team_id: string | null
        assigned: bigint
        completed: bigint
        on_time: bigint
        late: bigint
        overdue: bigint
        in_progress: bigint
        on_hold: bigint
        discarded: bigint
        due_this_week: bigint
        done_this_week: bigint
        open_todo: bigint
        open_progress: bigint
        allocated_hours: number | null
        spent_hours: number | null
      }

      const groups = await db.$queryRaw<GroupRow[]>`
        SELECT
          t.assignee_id,
          t.project_id,
          t.team_id,
          COUNT(*)                                                      AS assigned,
          COUNT(*) FILTER (WHERE t.status = 'DONE')                     AS completed,
          COUNT(*) FILTER (
            WHERE t.status = 'DONE'
              AND (t.due_date IS NULL OR t.completed_at IS NULL
                   OR t.completed_at <= ${DUE_END})
          )                                                             AS on_time,
          COUNT(*) FILTER (
            WHERE t.status = 'DONE'
              AND t.due_date IS NOT NULL AND t.completed_at IS NOT NULL
              AND t.completed_at > ${DUE_END}
          )                                                             AS late,
          COUNT(*) FILTER (WHERE ${OVERDUE})                            AS overdue,
          COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')              AS in_progress,
          -- The four "live" buckets below all exclude OVERDUE, so the five
          -- chart states stay MUTUALLY EXCLUSIVE and the donut still sums to
          -- the total. Overdue outranks on-hold: a held task past its date is
          -- counted once, as late, not twice.
          COUNT(*) FILTER (WHERE t.status = 'ON_HOLD' AND NOT ${LATE})  AS on_hold,
          COUNT(*) FILTER (WHERE t.status IN ('DISCARDED', 'CANCELLED')) AS discarded,
          COUNT(*) FILTER (
            WHERE t.due_date >= ${weekStart} AND t.due_date < ${weekEnd}
          )                                                             AS due_this_week,
          COUNT(*) FILTER (
            WHERE t.status = 'DONE'
              AND t.completed_at >= ${weekStart} AND t.completed_at < ${weekEnd}
          )                                                             AS done_this_week,
          COUNT(*) FILTER (
            WHERE NOT ${CLOSED} AND NOT ${LATE}
              AND t.status NOT IN ('IN_PROGRESS', 'IN_REVIEW', 'ON_HOLD')
          )                                                             AS open_todo,
          COUNT(*) FILTER (
            WHERE NOT ${CLOSED} AND NOT ${LATE}
              AND t.status IN ('IN_PROGRESS', 'IN_REVIEW')
          )                                                             AS open_progress,
          COALESCE(SUM(t.estimated_hours), 0)                           AS allocated_hours,
          COALESCE(SUM(t.logged_hours), 0)                              AS spent_hours
        FROM project_tasks t
        LEFT JOIN project_teams tm ON tm.id = t.team_id
        LEFT JOIN projects      p  ON p.id  = t.project_id
        WHERE ${scopeSql} AND ${projectSql} AND ${fromSql} AND ${toSql}
        GROUP BY t.assignee_id, t.project_id, t.team_id
      `

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
        // `inProgress` and `overdue` overlap; these split the same tasks so each is counted exactly once
        // (completed + discarded + onHold + overdue + openProgress + openTodo = assigned).
        openTodo: number
        openProgress: number
        allocatedHours: number
        spentHours: number
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
        openTodo: 0,
        openProgress: 0,
        allocatedHours: 0,
        spentHours: 0,
      })

      // COUNT() arrives as BigInt; SUM() of a float column as a number.
      const add = (b: Bucket, g: GroupRow) => {
        b.assigned += Number(g.assigned)
        b.completed += Number(g.completed)
        b.onTime += Number(g.on_time)
        b.late += Number(g.late)
        b.overdue += Number(g.overdue)
        b.inProgress += Number(g.in_progress)
        b.onHold += Number(g.on_hold)
        b.discarded += Number(g.discarded)
        b.dueThisWeek += Number(g.due_this_week)
        b.doneThisWeek += Number(g.done_this_week)
        b.openTodo += Number(g.open_todo)
        b.openProgress += Number(g.open_progress)
        b.allocatedHours += Number(g.allocated_hours ?? 0)
        b.spentHours += Number(g.spent_hours ?? 0)
      }

      // Not narrowed by the date range: overdueNow is about today; the trend needs eight weeks for a shape.
      const trendStart = new Date(weekStart)
      trendStart.setUTCDate(trendStart.getUTCDate() - 7 * 7)

      const [[overdueRow], completedByWeek, dueByWeek] = await Promise.all([
        db.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n
          FROM project_tasks t
          LEFT JOIN project_teams tm ON tm.id = t.team_id
          LEFT JOIN projects      p  ON p.id  = t.project_id
          WHERE ${scopeSql} AND ${projectSql} AND ${OVERDUE}
        `,
        db.$queryRaw<{ wk: Date; n: number }[]>`
          SELECT date_trunc('week', t.completed_at) AS wk, COUNT(*)::int AS n
          FROM project_tasks t
          LEFT JOIN project_teams tm ON tm.id = t.team_id
          LEFT JOIN projects      p  ON p.id  = t.project_id
          WHERE ${scopeSql} AND ${projectSql}
            AND t.status = 'DONE'
            AND t.completed_at >= ${trendStart} AND t.completed_at < ${weekEnd}
          GROUP BY 1
        `,
        db.$queryRaw<{ wk: Date; n: number }[]>`
          SELECT date_trunc('week', t.due_date::timestamp) AS wk, COUNT(*)::int AS n
          FROM project_tasks t
          LEFT JOIN project_teams tm ON tm.id = t.team_id
          LEFT JOIN projects      p  ON p.id  = t.project_id
          WHERE ${scopeSql} AND ${projectSql}
            AND t.due_date >= ${trendStart} AND t.due_date < ${weekEnd}
          GROUP BY 1
        `,
      ])
      const overdueNow = Number(overdueRow?.n ?? 0)

      // Keyed by date so the lookup doesn't depend on how the driver renders midnight.
      const key = (d: Date) => d.toISOString().slice(0, 10)
      const completedMap = new Map(completedByWeek.map((r) => [key(r.wk), Number(r.n)]))
      const dueMap = new Map(dueByWeek.map((r) => [key(r.wk), Number(r.n)]))
      const trend: { weekStart: string; completed: number; due: number }[] = []
      for (let i = 7; i >= 0; i--) {
        const start = new Date(weekStart)
        start.setUTCDate(start.getUTCDate() - i * 7)
        const k = key(start)
        trend.push({ weekStart: k, completed: completedMap.get(k) ?? 0, due: dueMap.get(k) ?? 0 })
      }

      const summary = zero()
      const byEmp = new Map<string, Bucket>()
      const byProj = new Map<string, Bucket>()
      const byTeamMap = new Map<string, Bucket>()
      // Teamless tasks still need a bar, or the team bars wouldn't add up to the donut.
      const NO_TEAM = "__no_team__"

      for (const g of groups) {
        add(summary, g)
        if (g.assignee_id) {
          const b = byEmp.get(g.assignee_id) ?? zero()
          add(b, g)
          byEmp.set(g.assignee_id, b)
        }
        if (g.project_id) {
          const b = byProj.get(g.project_id) ?? zero()
          add(b, g)
          byProj.set(g.project_id, b)
        }
        // Only within one project: across the portfolio, same-named teams from different clients would merge.
        if (projectId) {
          const key = g.team_id ?? NO_TEAM
          const b = byTeamMap.get(key) ?? zero()
          add(b, g)
          byTeamMap.set(key, b)
        }
      }

      const teamIds = [...byTeamMap.keys()].filter((k) => k !== NO_TEAM)
      const [empInfo, projInfo, teamInfo] = await Promise.all([
        byEmp.size
          ? db.employee.findMany({
              where: { id: { in: [...byEmp.keys()] } },
              select: { id: true, firstName: true, lastName: true, profilePhoto: true },
            })
          : Promise.resolve([]),
        byProj.size
          ? db.project.findMany({
              where: { id: { in: [...byProj.keys()] } },
              select: { id: true, name: true, code: true, slug: true },
            })
          : Promise.resolve([]),
        teamIds.length
          ? db.projectTeam.findMany({
              where: { id: { in: teamIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ])
      const empById = new Map(empInfo.map((e) => [e.id, e]))
      const projById = new Map(projInfo.map((p) => [p.id, p]))
      const teamById = new Map(teamInfo.map((t) => [t.id, t]))

      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)
      const withRates = (b: Bucket) => ({
        ...b,
        completionRate: pct(b.completed, b.assigned - b.discarded),
        onTimeRate: pct(b.onTime, b.completed),
      })

      const byEmployee = [...byEmp.entries()]
        .flatMap(([id, b]) => {
          const info = empById.get(id)
          return info
            ? [
                {
                  id: info.id,
                  name: `${info.firstName} ${info.lastName}`.trim(),
                  profilePhoto: info.profilePhoto,
                  ...withRates(b),
                },
              ]
            : []
        })
        .sort((a, b) => b.completed - a.completed || (b.onTimeRate ?? -1) - (a.onTimeRate ?? -1))

      const byProject = [...byProj.entries()]
        .flatMap(([id, b]) => {
          const info = projById.get(id)
          return info
            ? [{ id: info.id, name: info.name, code: info.code, slug: info.slug, ...withRates(b) }]
            : []
        })
        .sort((a, b) => b.assigned - a.assigned)

      const byTeam = [...byTeamMap.entries()]
        .flatMap(([id, b]) => {
          if (id === NO_TEAM)
            return b.assigned > 0 ? [{ id, name: "No team", ...withRates(b) }] : []
          const info = teamById.get(id)
          return info ? [{ id: info.id, name: info.name, ...withRates(b) }] : []
        })
        .sort((a, b) => b.assigned - a.assigned)

      // The picker's options must not follow the filters, or there'd be no way back from one project.
      const projects = (
        await db.project.findMany({
          where: { tasks: { some: scopeWhere } },
          select: { id: true, name: true, code: true, slug: true },
        })
      ).sort((a, b) => a.name.localeCompare(b.name))

      return NextResponse.json({
        data: {
          summary: withRates(summary),
          overdueNow,
          trend,
          byEmployee,
          byProject,
          /** Only populated when narrowed to one project. */
          byTeam,
          projects,
          scope: isAdmin ? "all" : "mine",
        },
      })
    } catch (error) {
      console.error("[projects/performance] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
