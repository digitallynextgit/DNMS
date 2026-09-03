import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"

// GET /api/projects/tasks
//
// The tasks BEHIND a number on the Progress page. Every tile, donut slice and
// bar there is a count; this is the list that count was made from, so a
// drill-down can show "which 42" rather than restating "42".
//
// ── THE STATES ARE THE PERFORMANCE ROUTE'S, EXACTLY ──────────────────────────
// `state` maps onto the same five mutually exclusive buckets that
// /api/projects/performance stacks and slices, with the same definitions (an
// open task past its due date is OVERDUE and nothing else; the rest split by
// whether work has started). If the two ever disagreed, a slice of 42 would
// open a list of 39, and the whole page would stop being believed.
//
// Same visibility rule as that route too: admins see everything, everyone else
// the teams they manage, the projects they own and their own tasks.
//
// Static segment beside the dynamic [id] one, like /api/projects/performance
// and /api/projects/goals - Next resolves the literal path first.
export const dynamic = "force-dynamic"

const STATES = ["overdue", "todo", "progress", "hold", "done", "open", "all"] as const
type State = (typeof STATES)[number]

// The popup pages by 150 and "show more" grows the page; 900 is six pages,
// past which a list is a search problem rather than a scrolling one.
const MAX_LIMIT = 900

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    const stateRaw = q.get("state") ?? "all"
    if (!(STATES as readonly string[]).includes(stateRaw)) {
      return NextResponse.json({ error: `Unknown state "${stateRaw}"` }, { status: 400 })
    }
    const state = stateRaw as State
    const projectId = q.get("projectId") ?? undefined
    const assigneeId = q.get("assigneeId") ?? undefined
    const teamId = q.get("teamId") ?? undefined
    const from = q.get("from")
    const to = q.get("to")
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.get("limit") ?? 150) || 150))

    const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
    const scope: Prisma.ProjectTaskWhereInput = isAdmin
      ? {}
      : {
          OR: [
            { team: { managerId: session.user.id } },
            { project: { ownerId: session.user.id } },
            { assigneeId: session.user.id },
          ],
        }

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    // Mirrors the SQL predicates in the performance route, expressed as
    // exclusions rather than inclusions so a legacy CANCELLED row lands in the
    // same bucket on both sides: OPEN is "not done, not discarded, not on
    // hold"; LATE is a due date before today.
    const CLOSED = ["DONE", "DISCARDED", "ON_HOLD"] as const
    const notLate: Prisma.ProjectTaskWhereInput = {
      OR: [{ dueDate: null }, { dueDate: { gte: todayStart } }],
    }
    const byState: Record<State, Prisma.ProjectTaskWhereInput> = {
      overdue: { status: { notIn: [...CLOSED] }, dueDate: { lt: todayStart } },
      todo: { status: { notIn: [...CLOSED, "IN_PROGRESS", "IN_REVIEW"] }, ...notLate },
      progress: { status: { in: ["IN_PROGRESS", "IN_REVIEW"] }, ...notLate },
      hold: { status: "ON_HOLD" },
      done: { status: "DONE" },
      // "Open" on the tile = pending = assigned minus completed minus discarded,
      // which INCLUDES on-hold work. Not the same set as OPEN above.
      open: { status: { notIn: ["DONE", "DISCARDED"] } },
      all: {},
    }

    const where: Prisma.ProjectTaskWhereInput = {
      AND: [
        scope,
        byState[state],
        projectId ? { projectId } : {},
        assigneeId ? { assigneeId } : {},
        teamId ? { teamId } : {},
        from ? { dueDate: { gte: new Date(`${from}T00:00:00.000Z`) } } : {},
        to ? { dueDate: { lte: new Date(`${to}T23:59:59.999Z`) } } : {},
      ],
    }

    const [total, rows] = await Promise.all([
      db.projectTask.count({ where }),
      db.projectTask.findMany({
        where,
        take: limit,
        // Each list reads in the order its question is asked. "What did we
        // finish" is newest first. "What is late" is longest-late first - the
        // one to chase. "What is coming" is soonest first.
        orderBy:
          state === "done"
            ? [{ completedAt: { sort: "desc", nulls: "last" } }, { dueDate: "desc" }]
            : [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          estimatedHours: true,
          loggedHours: true,
          inProgressSince: true,
          holdExpectedDate: true,
          project: { select: { id: true, name: true, code: true, slug: true } },
          team: { select: { id: true, name: true } },
          assignee: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
        },
      }),
    ])

    const day = 86_400_000
    const data = rows.map((t) => {
      const late =
        t.dueDate && t.dueDate < todayStart && !(CLOSED as readonly string[]).includes(t.status)
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        estimatedHours: t.estimatedHours,
        loggedHours: t.loggedHours,
        running: t.inProgressSince !== null,
        holdExpectedDate: t.holdExpectedDate?.toISOString().slice(0, 10) ?? null,
        overdue: Boolean(late),
        /** Whole days past due, for the "12d late" chip. 0 when not late. */
        daysLate: late ? Math.floor((todayStart.getTime() - t.dueDate!.getTime()) / day) : 0,
        project: t.project,
        team: t.team,
        assignee: t.assignee
          ? {
              id: t.assignee.id,
              name: `${t.assignee.firstName} ${t.assignee.lastName ?? ""}`.trim(),
              profilePhoto: t.assignee.profilePhoto,
            }
          : null,
      }
    })

    return NextResponse.json({ data, total, truncated: total > data.length })
  },
)
