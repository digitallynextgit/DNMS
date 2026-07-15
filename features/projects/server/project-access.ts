import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// =============================================================================
// Who may manage a project?
//   • anyone with the global `project:write` permission (admins / PMs), OR
//   • the project's ACCOUNT MANAGER (its owner) - they run their own project and
//     can do anything inside it, even without the global permission.
// =============================================================================

export async function canManageProject(session: Session, projectId: string): Promise<boolean> {
  if (hasPermission(session, PERMISSIONS.PROJECT_WRITE)) return true
  if (!projectId) return false
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  return !!project && project.ownerId === session.user.id
}

/**
 * Who may VIEW a project (read its teams/tasks/resources/etc)?
 *   • anyone with `project:read` or `project:write` (admins / PMs / HR), OR
 *   • the project's owner (Account Manager), OR
 *   • a member of any team in the project.
 *
 * Project access is MEMBERSHIP-based, not purely role-based: an account manager is
 * a plain employee on some projects and the owner on others. The middleware guard
 * can't do this per-project DB check, so it lets any authenticated user reach the
 * project routes and each read route enforces this instead.
 */
export async function canAccessProject(session: Session, projectId: string): Promise<boolean> {
  if (
    hasPermission(session, PERMISSIONS.PROJECT_READ) ||
    hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  )
    return true
  if (!projectId) return false
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: session.user.id },
        { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
      ],
    },
    select: { id: true },
  })
  return !!project
}

type ProjectHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
  session: Session,
) => Promise<Response> | Response

/**
 * Route guard for project-scoped writes: allows `project:write` holders AND the
 * project's Account Manager. Expects the project id at `ctx.params.id`.
 */
export function withProjectManager(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    const projectId = ctx.params.id
    if (!(await canManageProject(session, projectId))) {
      return NextResponse.json(
        { error: "Only the Account Manager or a project admin can do this" },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}

/**
 * Route guard for project-scoped READS: allows anyone who can access the project
 * (see canAccessProject). Since the middleware no longer requires `project:read`
 * to reach /projects, this is what stops a non-member from reading a project by id.
 */
export function withProjectAccess(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    if (!(await canAccessProject(session, ctx.params.id))) {
      return NextResponse.json({ error: "You don't have access to this project" }, { status: 403 })
    }
    return handler(req, ctx, session)
  })
}
