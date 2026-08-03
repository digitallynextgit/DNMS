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

/**
 * Who may STAFF a team (add/remove its members)?
 *   • anyone who can manage the project (see canManageProject), OR
 *   • the manager of a team inside it.
 *
 * A team manager is usually a plain employee - a Design Lead has no
 * `project:write` and does not own the project - but they are the person who
 * actually knows who should be on their team, so they staff it themselves.
 * Pass `teamId` to check one specific team; omit it to ask "do they manage ANY
 * team here", which is what the shared member picker needs.
 */
export async function canStaffTeam(
  session: Session,
  projectId: string,
  teamId?: string,
): Promise<boolean> {
  if (await canManageProject(session, projectId)) return true
  if (!projectId) return false
  const team = await db.projectTeam.findFirst({
    where: { projectId, managerId: session.user.id, ...(teamId ? { id: teamId } : {}) },
    select: { id: true },
  })
  return !!team
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
 * Route guard for the team-staffing surface: allows `project:write` holders, the
 * project's Account Manager, AND any team manager inside the project. Expects
 * the project id at `ctx.params.id` and, when the route is team-scoped, the team
 * id at `ctx.params.teamId`.
 */
export function withTeamStaffing(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    if (!(await canStaffTeam(session, ctx.params.id, ctx.params.teamId))) {
      return NextResponse.json(
        { error: "Only a project admin, the Account Manager or a team manager can do this" },
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
