import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { reportingLine } from "@/lib/reporting-line"
import type { AssignContext } from "../lib/task-assign"
import { canManageProject } from "./project-access"

export interface TeamAssignContext extends AssignContext {
  teamName: string
  managerId: string | null
  /** Members by id, for pickers and messages. */
  memberNames: Map<string, string>
}

/** The assignment rule's inputs for this person on this team. Null when the team isn't on the project. */
export async function teamAssignContext(
  session: Session,
  projectId: string,
  teamId: string,
): Promise<TeamAssignContext | null> {
  const team = await db.projectTeam.findFirst({
    where: { id: teamId, projectId },
    select: {
      name: true,
      managerId: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: { employee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  })
  if (!team) return null
  const me = session.user.id
  const canAssignAnyone = team.managerId === me || (await canManageProject(session, projectId))
  // The whole org is needed to walk the line; skipped when it can't change the answer.
  const reportIds = canAssignAnyone
    ? []
    : reportingLine(
        me,
        await db.employee.findMany({
          where: { isActive: true },
          select: { id: true, managerId: true, dottedManagerId: true },
        }),
      )
  return {
    actorId: me,
    canAssignAnyone,
    teamMemberIds: team.members.map((m) => m.employee.id),
    reportIds,
    teamName: team.name,
    managerId: team.managerId,
    memberNames: new Map(
      team.members.map((m) => [
        m.employee.id,
        `${m.employee.firstName} ${m.employee.lastName ?? ""}`.trim(),
      ]),
    ),
  }
}
