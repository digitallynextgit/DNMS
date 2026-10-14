import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { PROJECT_LEADS_SELECT, isProjectLead, leadConditions } from "../lib/project-leads"
import type { Session } from "next-auth"

// Managing a project: global `project:write`, or one of its Account Managers - primary or secondary,
// with the same powers (lib/project-leads.ts).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** URL slug or uuid -> project id. Old links use uuids, so uuid-shaped input skips the lookup. */
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
    select: PROJECT_LEADS_SELECT,
  })
  return !!project && isProjectLead(project, session.user.id)
}

/**
 * View: `project:read`/`project:write`, an Account Manager, or a member of any team on it. Membership is
 * per project, so the middleware lets everyone through and each read route checks this.
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
        ...leadConditions(session.user.id),
        { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
      ],
    },
    select: { id: true },
  })
  return !!project
}

/**
 * A project task: whoever can access the project. An adhoc task: its assignee, creator or the
 * assignee's line manager. False if the task doesn't exist.
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
 * Staff a team: project managers, or the manager of a team inside it. Pass `teamId` for one team;
 * omit it to ask "do they manage ANY team here" (the shared member picker).
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

/** Write guard: `project:write` holders and the project's Account Managers. Project id at `ctx.params.id`. */
export function withProjectManager(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    // Handlers read ctx.params.id, so swapping in the real id makes every route slug-tolerant.
    ctx.params.id = projectId
    if (!(await canManageProject(session, projectId))) {
      return NextResponse.json(
        { error: "Only an Account Manager or a project admin can do this" },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}

/** Staffing guard: project managers plus any team manager in the project. */
export function withTeamStaffing(handler: ProjectHandler) {
  return withSession(async (req, ctx, session) => {
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    ctx.params.id = projectId
    if (!(await canStaffTeam(session, projectId, ctx.params.teamId))) {
      return NextResponse.json(
        {
          error: "Only a project admin, an Account Manager or a team manager can do this",
        },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}

/** Read guard: anyone who can access the project (the middleware doesn't check membership). */
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
 * Edit a team's calendar row: project managers, the calendar's manager or - when that manager is the
 * service's owner - its secondary owner (any row), or that team's own manager (own row only - which
 * is why this isn't withTeamStaffing). Members are not enough.
 * Omit `teamId` to ask "may they edit anything on this plan" (the Add team button).
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
    select: { assignedToId: true, service: true },
  })
  // Not found = not on this project, or doesn't exist; both are no.
  if (!workbook) return false
  if (workbook.assignedToId === session.user.id) return true
  if (workbook.service && workbook.assignedToId) {
    const covering = await db.projectServiceOwner.count({
      where: {
        projectId,
        service: workbook.service,
        employeeId: workbook.assignedToId,
        secondaryEmployeeId: session.user.id,
      },
    })
    if (covering > 0) return true
  }

  return canStaffTeam(session, projectId, teamId)
}

/**
 * Hand work in against a team's row (links, files, status): anyone on that project team - wider
 * than canEditWorkbookTeam, which governs planning the row.
 */
export async function canContributeToWorkbookTeam(
  session: Session,
  projectId: string,
  workbookId: string,
  teamId: string,
): Promise<boolean> {
  if (await canEditWorkbookTeam(session, projectId, workbookId, teamId)) return true
  if (!projectId || !workbookId || !teamId) return false

  // The calendar must be ON this project, or a team member of project A could pass for project B.
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

/** Contribute guard: team members + planners. Routes must still gate the planning fields. */
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

/** Team-plan guard. The team comes from the PATH: reading the body would consume the stream. */
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
            "Only a project admin, an Account Manager, the calendar's manager or that team's own manager can do this",
        },
        { status: 403 },
      )
    }
    return handler(req, ctx, session)
  })
}
