import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { openFirstStatusPeriod } from "@/features/projects/server/task-status-periods"
import type { Session } from "next-auth"

/**
 * What this caller manages: the project teams they run, and every person under
 * them. "Under them" is the union of two things, because either alone is wrong -
 * a team manager owns their team's tasks whether or not the HR reporting line
 * agrees, and a line manager owns their reports' work wherever it sits.
 *
 * Drives both the picker the client renders AND the authorisation for it: a
 * scope the caller does not manage simply is not in these lists, so it cannot
 * be selected and is rejected if asked for directly.
 *
 * `seesEveryone` widens that to the whole company. It is for project admins,
 * who already read every project and therefore every task inside it - this only
 * lets them ask the same question by PERSON instead of by project.
 */
async function getManagedScope(userId: string, seesEveryone: boolean) {
  const [reports, managedTeams, everyone] = await Promise.all([
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
      orderBy: { name: "asc" },
    }),
    seesEveryone
      ? db.employee.findMany({
          // Never the silent admin_ watch account (HIDDEN_ROLES).
          where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
  ])

  // isReport separates the two ways someone can be "under" you. A DIRECT REPORT
  // is your subordinate and belongs in the people picker unconditionally; a team
  // member you merely manage the team of does not - they surface only once that
  // team is selected. Both are still authorised for scope=all, which is why
  // this is one list with a flag rather than two.
  const people = new Map<string, { id: string; name: string; isReport: boolean }>()
  // Seeded FIRST, so the two passes below still mark an admin's own team members
  // and reports correctly rather than being skipped as already-present entries.
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
  // After the team pass, so a direct report who is also on a team you manage is
  // still flagged as a report rather than being overwritten as a plain member.
  for (const r of reports) {
    people.set(r.id, { id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), isReport: true })
  }
  // You are not your own subordinate; "Me" is a separate option in the picker.
  people.delete(userId)

  return {
    teams: managedTeams.map((t) => ({
      id: t.id,
      name: t.name,
      projectName: t.project.name,
      memberIds: t.members.map((m) => m.employeeId),
    })),
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    // Tells the client the list is the ROSTER, not a reporting line, so it can
    // offer all of it instead of only the direct reports on it.
    seesEveryone,
  }
}

// GET /api/tasks?mine=true[&scope=…] - the caller's task list.
//
//   scope=me            (default) just them
//   scope=all           them plus everyone they manage
//   scope=team:<teamId> one project team they manage
//   scope=user:<empId>  one person they manage (a project admin: anyone)
//
// An unrecognised or unauthorised scope falls back to "me" rather than erroring:
// the picker is built from the same data, so the only way to ask for something
// else is by hand, and the safe answer to that is your own tasks.
export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const mine = searchParams.get("mine") === "true"
    const scope = searchParams.get("scope") ?? "me"
    const status = searchParams.get("status") ?? undefined
    const userId = session.user.id

    // Project admins answer for every account, so every person is theirs to
    // look at - the same reach they already have through the project pages.
    const seesEveryone = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

    // Resolved on every "mine" call: the client builds its picker from this, so
    // it costs one pair of reads instead of a second endpoint and a round trip.
    const managed = mine
      ? await getManagedScope(userId, seesEveryone)
      : {
          teams: [] as { id: string; name: string; projectName: string; memberIds: string[] }[],
          people: [] as { id: string; name: string }[],
          seesEveryone: false,
        }

    let assigneeIds: string[] = [userId]
    if (scope === "all") {
      assigneeIds = [userId, ...managed.people.map((p) => p.id)]
    } else if (scope.startsWith("team:")) {
      const team = managed.teams.find((t) => t.id === scope.slice(5))
      if (team) assigneeIds = team.memberIds.length > 0 ? team.memberIds : [userId]
    } else if (scope.startsWith("user:")) {
      const person = managed.people.find((p) => p.id === scope.slice(5))
      if (person) assigneeIds = [person.id]
    }

    const tasks = await db.projectTask.findMany({
      where: {
        ...(mine && { assigneeId: { in: assigneeIds } }),
        ...(status && { status: status as never }),
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      include: {
        project: { select: { id: true, name: true, code: true, slug: true } },
        // managerId rides along so the client can apply the same edit/delete
        // rules the API enforces, instead of offering controls that 403.
        team: { select: { id: true, name: true, managerId: true } },
        // managerId: adhoc work has no team, so the assignee's LINE manager is
        // the authority on it - the client needs that to match the API's rules.
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            managerId: true,
          },
        },
        // Drives the "Blocked" badge - a task waiting on a requirement should say
        // so wherever it is listed, not only inside the project.
        requirement: { select: { id: true, title: true, status: true } },
      },
    })

    return NextResponse.json({
      data: tasks,
      meta: {
        // The picker's options, minus the member id lists (the client never
        // needs them and they are only used to resolve the scope server-side).
        teams: managed.teams.map(({ id, name, projectName }) => ({ id, name, projectName })),
        people: managed.people,
        // Whether that list is everyone or only the caller's own reports.
        seesEveryone: managed.seesEveryone,
      },
    })
  } catch (error) {
    console.error("[TASKS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// POST /api/tasks - raise an ADHOC task: work that belongs to no client.
//
// Meetings, interviews, internal QC. There is no project and no team to file it
// under, which is the whole point - it used to be forced into a stand-in "ADHOC"
// project that then behaved like a client account everywhere.
//
// Who may raise work on WHOM still follows the line manager, but nothing waits
// for approval: adhoc work you raise on yourself is workable immediately, the
// same as a project task.
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

    // You may raise adhoc work on yourself, on someone who reports to you, or
    // anywhere if you administer projects. Without this anyone could drop work
    // onto anyone, which the project route is careful not to allow either.
    const isSelf = assigneeId === session.user.id
    const managesAssignee = assignee.managerId === session.user.id
    if (!isSelf && !managesAssignee && !isAdmin) {
      return NextResponse.json(
        { error: "You can only raise adhoc work on yourself or someone who reports to you." },
        { status: 403 },
      )
    }

    const task = await db.projectTask.create({
      data: {
        projectId: null,
        teamId: null,
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

    await openFirstStatusPeriod(db, {
      taskId: task.id,
      status: task.status,
      actorId: session.user.id,
      at: task.createdAt,
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
