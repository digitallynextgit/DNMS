import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
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
 */
async function getManagedScope(userId: string) {
  const [reports, managedTeams] = await Promise.all([
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
  ])

  const people = new Map<string, { id: string; name: string }>()
  for (const r of reports) {
    people.set(r.id, { id: r.id, name: `${r.firstName} ${r.lastName}`.trim() })
  }
  for (const t of managedTeams) {
    for (const m of t.members) {
      people.set(m.employeeId, {
        id: m.employeeId,
        name: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
      })
    }
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
  }
}

// GET /api/tasks?mine=true[&scope=…] - the caller's task list.
//
//   scope=me            (default) just them
//   scope=all           them plus everyone they manage
//   scope=team:<teamId> one project team they manage
//   scope=user:<empId>  one person they manage
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

    // Resolved on every "mine" call: the client builds its picker from this, so
    // it costs one pair of reads instead of a second endpoint and a round trip.
    const managed = mine
      ? await getManagedScope(userId)
      : {
          teams: [] as { id: string; name: string; projectName: string; memberIds: string[] }[],
          people: [] as { id: string; name: string }[],
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
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
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
      },
    })
  } catch (error) {
    console.error("[TASKS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
