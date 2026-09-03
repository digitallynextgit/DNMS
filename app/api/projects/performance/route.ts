import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
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

      // Optional narrowing. `projectId` scopes to one project; `from`/`to`
      // (inclusive, yyyy-mm-dd) scope to tasks DUE inside the window - the
      // question this page answers is "what was due in this period", so an
      // undated task is out of scope for a dated view by definition.
      const { searchParams } = req.nextUrl
      const projectId = searchParams.get("projectId") ?? undefined
      const from = searchParams.get("from")
      const to = searchParams.get("to")

      // (`from`/`to` are applied as SQL predicates on the aggregate below;
      // there is no longer a Prisma `where` object to build them into.)

      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      // Current week window (Mon 00:00 → next Mon 00:00, UTC).
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setUTCHours(0, 0, 0, 0)
      weekStart.setUTCDate(weekStart.getUTCDate() - ((now.getUTCDay() + 6) % 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

      // ── Aggregate in the DATABASE, not in Node ──────────────────────────────
      //
      // This used to `findMany` every matching task and tally it in a JS loop.
      // With no filters (and "All time" is a real preset on the page, not just a
      // hand-crafted request) `where` collapsed to `{ AND: [] }` for an admin,
      // so the whole project_tasks table streamed into Node on a page load.
      //
      // Truncating was not an option: this page is nothing but aggregates, and a
      // clipped scan reports confidently WRONG totals. So the tally moved into
      // one grouped query instead.
      //
      // Grouped by (assignee, project) rather than aggregated three times: every
      // bucket is an additive count/sum, so summary, byEmployee and byProject are
      // all cheap roll-ups of the same small result. That also preserves the
      // original semantics exactly - summary counted every task, byEmployee only
      // tasks WITH an assignee, byProject only tasks WITH a project - because the
      // NULL groups simply drop out of the respective roll-up.
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

      // ── What "overdue" means ────────────────────────────────────────────────
      //
      // PAST ITS DATE AND NOT FINISHED. That is the whole rule. It deliberately
      // does NOT also require the task to be actively in play: a task parked on
      // hold is still work that was promised for a date that has gone by, and
      // hiding it made the number smaller than the truth.
      //
      // CLOSED is "finished or dropped" - the only states that can never be
      // overdue, because nobody owes them any more. CANCELLED is legacy and
      // rides with DISCARDED.
      const CLOSED = Prisma.sql`(t.status IN ('DONE', 'DISCARDED', 'CANCELLED'))`
      // due_date is @db.Date, so it reads back as UTC midnight. Strictly before
      // today's midnight, so a task due TODAY has all of today to be done.
      const LATE = Prisma.sql`(t.due_date IS NOT NULL AND t.due_date < ${todayStart})`
      const OVERDUE = Prisma.sql`(NOT ${CLOSED} AND ${LATE})`
      // The original compared completedAt against dueDate at 23:59:59.999 UTC.
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
      // team_id joined the GROUP BY so the Progress page can stack one bar per
      // TEAM inside a project on the same exclusive states as everything else.
      // Every other roll-up is a plain sum, so the finer grouping changes none
      // of their totals - a (person, project) pair now arrives as a few rows
      // instead of one and adds up the same.

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
        // ── Mutually exclusive display states ────────────────────────────────
        // `inProgress` and `overdue` above OVERLAP - a late in-progress task
        // increments both - which is right for "how many are late" but wrong for
        // any part-to-whole chart, where it would count that task twice and the
        // slices would not sum to the total. These split the same tasks into
        // buckets that each own a task exactly once:
        //   completed + discarded + onHold + overdue + openProgress + openTodo
        //   = assigned
        // Added alongside the originals rather than replacing them, so the AI
        // briefing and the drill-downs keep the numbers they were written for.
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

      // Every bucket is additive, so folding a group row into a bucket is just
      // a sum. COUNT() comes back as BigInt over the wire; SUM() of a float
      // column comes back as a number.
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

      // ── Two figures the date range must NOT narrow ─────────────────────────
      //
      // overdueNow: "what is late right now" is a question about today, not
      // about the window. With the page defaulting to This week, the range-
      // scoped overdue count silently dropped every task that fell late in an
      // earlier week and was still open - the ones a manager most needs to see.
      // The tile shows this; the range-scoped `overdue` in the buckets stays for
      // the charts that describe the window.
      //
      // trend: eight Monday-start weeks ending this one, so the pace line has a
      // shape. A pace line clipped to a one-week range is a single dot.
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

      // date_trunc returns the Monday as a timestamp; keyed by its date so the
      // lookup does not depend on how the driver renders midnight.
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
      // Teamless tasks still need a bar, or a project's team bars would not add
      // up to its donut. Same sentinel the per-project progress query uses.
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
        // Only meaningful inside one project: across the portfolio a "team"
        // bar would merge same-named teams from different clients.
        if (projectId) {
          const key = g.team_id ?? NO_TEAM
          const b = byTeamMap.get(key) ?? zero()
          add(b, g)
          byTeamMap.set(key, b)
        }
      }

      // Display info for just the ids that actually appear - a couple of small
      // keyed reads instead of joining these columns onto every task row.
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
              // slug: the drill-down links to the project page, and every link
              // in the app is slug-first (see projectHref).
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

      // The picker's option list must NOT follow the filters, or selecting a
      // project would leave it as the only option and there would be no way
      // back. Scope-filtered only.
      //
      // Queried off `projects` rather than `project_tasks` + distinct: the old
      // shape read one row PER TASK just to recover the project list behind them
      // - a second full scan of the same table the aggregate above already walked.
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
