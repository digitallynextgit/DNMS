import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { openFirstStatusPeriod } from "@/features/projects/server/task-status-periods"
import { sortProjectTeams } from "@/features/projects/lib/project-teams"
import type { Session } from "next-auth"

// What the caller manages: teams they run and everyone under them (team members + line reports). It drives
// both the picker and its authorisation. `seesEveryone` widens it to the whole company for project admins.
type PickablePerson = {
  id: string
  name: string
  isReport: boolean
  /** Deactivated - offered under "archived", never in the live lists. */
  former?: boolean
}

async function getManagedScope(userId: string, seesEveryone: boolean) {
  const [reports, managedTeams, everyone, left] = await Promise.all([
    db.employee.findMany({
      where: { managerId: userId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.projectTeam.findMany({
      where: { managerId: userId },
      select: {
        id: true,
        name: true,
        project: { select: { name: true } },
        members: {
          select: {
            employeeId: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { project: { name: "asc" } },
    }),
    seesEveryone
      ? db.employee.findMany({
          where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
    // Leavers whose tasks the caller could open (all for admins, former reports for managers) - archive only.
    db.employee.findMany({
      where: seesEveryone
        ? { isActive: false, ...VISIBLE_EMPLOYEE_FILTER }
        : { managerId: userId, isActive: false },
      select: { id: true, firstName: true, lastName: true },
    }),
  ])
  const leftWithTasks = new Set(
    left.length
      ? (
          await db.projectTask.findMany({
            where: { assigneeId: { in: left.map((e) => e.id) } },
            distinct: ["assigneeId"],
            select: { assigneeId: true },
          })
        ).map((t) => t.assigneeId)
      : [],
  )

  // isReport: direct reports always show in the picker; members of a team you manage only once that
  // team is selected. Both are authorised for scope=all.
  const people = new Map<string, PickablePerson>()
  // Seeded first, so the passes below still flag an admin's own team members and reports.
  for (const e of everyone) {
    people.set(e.id, { id: e.id, name: `${e.firstName} ${e.lastName}`.trim(), isReport: false })
  }
  for (const t of managedTeams) {
    for (const m of t.members) {
      people.set(m.employeeId, {
        id: m.employeeId,
        name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
        isReport: false,
      })
    }
  }
  // After the team pass, so a direct report on your team is still flagged as a report.
  for (const r of reports) {
    people.set(r.id, { id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), isReport: true })
  }
  // You are not your own subordinate; "Me" is a separate option in the picker.
  people.delete(userId)
  for (const e of left) {
    if (!leftWithTasks.has(e.id) || people.has(e.id)) continue
    people.set(e.id, {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      isReport: !seesEveryone,
      former: true,
    })
  }

  return {
    teams: sortProjectTeams(managedTeams).map((t) => ({
      id: t.id,
      name: t.name,
      projectName: t.project.name,
      memberIds: t.members.map((m) => m.employeeId),
    })),
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    seesEveryone,
  }
}

// Hard ceiling; overflow is reported via meta.truncated, never silent.
const TASK_LIST_LIMIT = 2000

// scope=me (default) | all | team:<teamId> | user:<empId>. Deactivated people come back with
// former: true, never in scope=all. An unknown or unauthorised scope falls back to "me".
export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const mine = searchParams.get("mine") === "true"
    const scope = searchParams.get("scope") ?? "me"
    const status = searchParams.get("status") ?? undefined
    const userId = session.user.id

    const seesEveryone = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

    const managed = mine
      ? await getManagedScope(userId, seesEveryone)
      : {
          teams: [] as { id: string; name: string; projectName: string; memberIds: string[] }[],
          people: [] as PickablePerson[],
          seesEveryone: false,
        }

    let assigneeIds: string[] = [userId]
    if (scope === "all") {
      assigneeIds = [userId, ...managed.people.filter((p) => !p.former).map((p) => p.id)]
    } else if (scope.startsWith("team:")) {
      const team = managed.teams.find((t) => t.id === scope.slice(5))
      if (team) assigneeIds = team.memberIds.length > 0 ? team.memberIds : [userId]
    } else if (scope.startsWith("user:")) {
      const person = managed.people.find((p) => p.id === scope.slice(5))
      if (person) assigneeIds = [person.id]
    }

    // Without `mine`, fall back to the caller's own tasks - never the whole table.
    const tasks = await db.projectTask.findMany({
      where: {
        assigneeId: { in: assigneeIds },
        ...(status && { status: status as never }),
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      // On scope=all an admin's assigneeIds is everyone, so take one extra row to detect truncation.
      take: TASK_LIST_LIMIT + 1,
      // holdReason/discardReason are @db.Text and no list consumer reads them.
      omit: { holdReason: true, discardReason: true },
      include: {
        project: { select: { id: true, name: true, code: true, slug: true } },
        // managerId lets the client apply the same edit/delete rules the API enforces.
        team: { select: { id: true, name: true, managerId: true } },
        // Adhoc work has no team, so the assignee's line manager is the authority on it.
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            managerId: true,
          },
        },
        requirement: { select: { id: true, title: true, status: true } },
        goal: { select: { id: true, title: true } },
        _count: { select: { deliverables: true } },
      },
    })

    const truncated = tasks.length > TASK_LIST_LIMIT
    if (truncated) tasks.length = TASK_LIST_LIMIT

    return NextResponse.json({
      data: tasks,
      meta: {
        truncated,
        limit: TASK_LIST_LIMIT,
        teams: managed.teams.map(({ id, name, projectName }) => ({ id, name, projectName })),
        people: managed.people,
        seesEveryone: managed.seesEveryone,
      },
    })
  } catch (error) {
    console.error("[TASKS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// Raises ADHOC work (meetings, interviews, QC) with no project or team. Nothing waits for approval.
export const POST = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const body = await req.json()
    const title = (body.title ?? "").toString().trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const assigneeId: string = body.assigneeId || session.user.id
    const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

    const assignee = await db.employee.findUnique({
      where: { id: assigneeId },
      select: { id: true, firstName: true, lastName: true, managerId: true, isActive: true },
    })
    if (!assignee || !assignee.isActive) {
      return NextResponse.json({ error: "Assignee not found" }, { status: 422 })
    }

    // On yourself, on a direct report, or anyone if you administer projects.
    const isSelf = assigneeId === session.user.id
    const managesAssignee = assignee.managerId === session.user.id
    if (!isSelf && !managesAssignee && !isAdmin) {
      return NextResponse.json(
        { error: "You can only raise adhoc work on yourself or someone who reports to you." },
        { status: 403 },
      )
    }

    // One transaction: a task and its first status period are created together.
    const task = await db.$transaction(async (tx) => {
      const created = await tx.projectTask.create({
        data: {
          projectId: null,
          teamId: null,
          // Adhoc work - meetings, interviews, QC - produces nothing to log.
          producesOutput: false,
          title,
          description: body.description?.trim() || null,
          status: "TODO",
          priority: body.priority || "MEDIUM",
          assigneeId,
          creatorId: session.user.id,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          estimatedHours: body.estimatedHours ? Number(body.estimatedHours) : null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          approvalStatus: "APPROVED",
          // Records who raised it, not who cleared it - nothing needs clearing.
          isManagerCreated: !isSelf,
        },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await openFirstStatusPeriod(tx, {
        taskId: created.id,
        status: created.status,
        actorId: session.user.id,
        at: created.createdAt,
      })

      return created
    })

    try {
      if (!isSelf) {
        await createNotification({
          employeeId: assigneeId,
          title: "New adhoc task",
          message: `${task.creator.firstName} assigned you: "${task.title}"`,
          type: "info",
          link: "/projects/my-tasks",
        })
      }
    } catch (_e) {
      /* non-blocking */
    }

    await createAuditLog(session, {
      action: "CREATE",
      module: "project",
      entityType: "ProjectTask",
      entityId: task.id,
      changes: { title: task.title, assigneeId, adhoc: true },
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    console.error("[ADHOC_TASK_POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
