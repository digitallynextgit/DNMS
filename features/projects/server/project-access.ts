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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Turn whatever is in the URL into a real project id.
 *
 * Project URLs are slugs now (/projects/rudione-leocym), but every id already
 * shared or stored - notification links, bookmarks - is a uuid, so both must
 * keep working. Anything uuid-shaped is taken as an id without a query; only a
 * slug costs a lookup. Returns null when nothing matches.
 */
export async function resolveProjectId(idOrSlug: string): Promise<string | null> {
  if (!idOrSlug) return null
  if (UUID_RE.test(idOrSlug)) return idOrSlug
  const project = await db.project.findFirst({
    where: { slug: idOrSlug },
    select: { id: true },
  })
  return project?.id ?? null
}

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
 * Who may read/act on a TASK (its comments, checklist, timeline)?
 *   • a project task → whoever can access the project (canAccessProject), OR
 *   • an adhoc task (no project) → the assignee, the creator, or the assignee's
 *     line manager - the only people it concerns.
 *
 * Tasks are addressed by a bare taskId at /api/tasks/[id]/*, with no project in
 * the URL, so the boundary has to be resolved from the task's own row. Returns
 * false if the task does not exist (handlers can 404 separately if they need to
 * distinguish, by loading the task themselves).
 */
export async function canAccessTask(session: Session, taskId: string): Promise<boolean> {
  if (!taskId) return false
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      assigneeId: true,
      creatorId: true,
      assignee: { select: { managerId: true } },
    },
  })
  if (!task) return false
  return task.projectId
    ? canAccessProject(session, task.projectId)
    : task.assigneeId === session.user.id ||
        task.creatorId === session.user.id ||
        task.assignee?.managerId === session.user.id
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
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    // Downstream handlers read ctx.params.id directly, so hand them the real id -
    // that is what makes every /api/projects/[id]/* route slug-tolerant at once.
    ctx.params.id = projectId
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
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    ctx.params.id = projectId
    if (!(await canStaffTeam(session, projectId, ctx.params.teamId))) {
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
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    ctx.params.id = projectId
    if (!(await canAccessProject(session, projectId))) {
      return NextResponse.json({ error: "You don't have access to this project" }, { status: 403 })
    }
    return handler(req, ctx, session)
  })
}

/**
 * May this person edit a TEAM'S ROW on a monthly calendar?
 *
 *   - anyone who can manage the project (Account Manager / project:write), or
 *   - the calendar's MANAGER (workbook.assignedToId), for ANY team's row: they
 *     supervise the month, so the whole plan is theirs, or
 *   - the manager of ONE team, for THEIR OWN team's row and nobody else's.
 *
 * That last case is the reason this cannot be `withTeamStaffing`. That guard
 * answers "do they manage any team on this project", which would let the Design
 * lead rewrite the video team's deadline. Pass `teamId` to ask about one row;
 * omit it to ask "may they edit anything on this plan at all", which is what
 * decides whether the Add team button is rendered.
 *
 * A team MEMBER is not enough, only its manager - the same line canStaffTeam
 * draws. Members contribute links and files to their own row, which is a
 * separate and narrower permission checked at the resource routes.
 */
export async function canEditWorkbookTeam(
  session: Session,
  projectId: string,
  workbookId: string,
  teamId?: string,
): Promise<boolean> {
  if (await canManageProject(session, projectId)) return true
  if (!projectId || !workbookId) return false

  const workbook = await db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId },
    select: { assignedToId: true },
  })
  // Not found means "not on this project" as much as "does not exist", and both
  // answers are no.
  if (!workbook) return false
  if (workbook.assignedToId === session.user.id) return true

  return canStaffTeam(session, projectId, teamId)
}

/**
 * Route guard for the calendar team-plan routes. Expects the project at
 * `ctx.params.id`, the calendar at `ctx.params.workbookId`, and - on the routes
 * that are about ONE row - the team at `ctx.params.teamId`.
 *
 * The team has to come from the PATH rather than the body: a guard that read
 * the body would consume the request stream the handler then needs. That is
 * why the team-plan routes are keyed on (workbookId, teamId) rather than on the
 * row's own id, which the fixed six-team catalogue makes natural anyway.
 */
/**
 * May this person HAND WORK IN against a team's row - links, files, and moving
 * the status along?
 *
 * Wider than canEditWorkbookTeam on purpose, and the distinction is the whole
 * point of putting the plan on the calendar:
 *
 *   PLAN the row   (who is on it, how many, by when)  - canEditWorkbookTeam
 *   DELIVER to it  (links, files, status)             - this
 *
 * Anybody on that project team qualifies. Not only the people NAMED on the row:
 * being named is an expectation, not a permission, and a colleague who picks up
 * a piece of it should not be turned away by the app. The row's member list
 * still says who is expected to do the work, and who gets notified.
 */
export async function canContributeToWorkbookTeam(
  session: Session,
  projectId: string,
  workbookId: string,
  teamId: string,
): Promise<boolean> {
  if (await canEditWorkbookTeam(session, projectId, workbookId, teamId)) return true
  if (!projectId || !workbookId || !teamId) return false

  // The calendar has to be ON this project. Team membership alone is not
  // enough: without this, somebody on a team of project A would pass for a
  // calendar row of project B. The routes scope the lookup before calling this,
  // so it is belt and braces - but a predicate that is only safe because of
  // where it happens to be called is one waiting to be called somewhere else.
  const workbook = await db.projectWorkbook.findFirst({
    where: { id: workbookId, projectId },
    select: { id: true },
  })
  if (!workbook) return false

  const membership = await db.projectTeamMember.findFirst({
    where: { projectId, teamId, employeeId: session.user.id },
    select: { id: true },
  })
  return !!membership
}

/**
 * Route guard for handing work in: anyone on that team, plus everyone who can
 * plan it. Routes behind this one must gate the PLANNING fields themselves -
 * see the PUT on /workbooks/[workbookId]/teams/[teamId].
 */
export function withWorkbookTeamContribute(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    ctx.params.id = projectId
    const allowed = await canContributeToWorkbookTeam(
      session,
      projectId,
      ctx.params.workbookId!,
      ctx.params.teamId!,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: "Only somebody on that team can hand work in against it" },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}

export function withWorkbookTeamAccess(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    ctx.params.id = projectId
    const allowed = await canEditWorkbookTeam(
      session,
      projectId,
      ctx.params.workbookId!,
      ctx.params.teamId,
    )
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Only a project admin, the Account Manager, the calendar's manager or that team's own manager can do this",
        },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}
