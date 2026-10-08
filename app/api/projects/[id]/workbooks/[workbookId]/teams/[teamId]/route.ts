import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import {
  canEditWorkbookTeam,
  withWorkbookTeamAccess,
  withWorkbookTeamContribute,
} from "@/features/projects/server/project-access"
import {
  removeWorkbookTeam,
  upsertWorkbookTeam,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"
import { logActivity } from "@/features/projects/server/activity"
import { createNotifications } from "@/lib/notifications"
import { isSafeHttpUrl } from "@/features/projects/lib/task-links"
import {
  WORKBOOK_TEAM_STATUSES,
  type WorkbookTeamStatus,
} from "@/features/projects/lib/workbook-team-progress"
import { formatMonth } from "@/features/projects/lib/calendar-months"
import { db } from "@/server/db"

// Keyed on (calendar, team), the row's natural key, so the guard can read the team from the URL
// (it can't read the body without consuming it).

const MAX_LINKS = 20

// Idempotent; omitted fields are left alone. The guard admits any team member (links/files/status);
// quantity/dueOn/employeeIds also need the AM, a project admin, or the calendar's or team's manager.
export const PUT = withWorkbookTeamContribute(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, workbookId, teamId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      quantity?: number | null
      dueOn?: string | null
      status?: unknown
      links?: unknown
      notes?: string | null
      employeeIds?: unknown
    }

    // http(s) only, so a stored javascript: URL can never become a click.
    let links: string[] | undefined
    if (body.links !== undefined) {
      if (!Array.isArray(body.links)) {
        return NextResponse.json({ error: "Links must be a list" }, { status: 422 })
      }
      links = body.links.filter((l): l is string => typeof l === "string" && l.trim() !== "")
      if (links.length > MAX_LINKS) {
        return NextResponse.json({ error: `Keep it to ${MAX_LINKS} links` }, { status: 422 })
      }
      const bad = links.find((l) => !isSafeHttpUrl(l))
      if (bad) {
        return NextResponse.json({ error: `"${bad}" is not a full http(s) link` }, { status: 422 })
      }
    }

    if (body.employeeIds !== undefined && !Array.isArray(body.employeeIds)) {
      return NextResponse.json({ error: "employeeIds must be a list" }, { status: 422 })
    }

    let status: WorkbookTeamStatus | undefined
    if (body.status !== undefined) {
      if (!WORKBOOK_TEAM_STATUSES.includes(body.status as WorkbookTeamStatus)) {
        return NextResponse.json({ error: "That is not a status" }, { status: 422 })
      }
      status = body.status as WorkbookTeamStatus
    }

    // Only look up planning rights when a planning field is present.
    const plans =
      body.quantity !== undefined ||
      body.dueOn !== undefined ||
      body.employeeIds !== undefined ||
      // Dropping the work is a planning decision; a member may say STUCK, not that it's no longer owed.
      status === "DISCARDED"
    if (plans && !(await canEditWorkbookTeam(session, projectId!, workbookId!, teamId!))) {
      return NextResponse.json(
        {
          error:
            "Only a project admin, the Account Manager, the calendar's manager or that team's own manager can change what a team owes.",
        },
        { status: 403 },
      )
    }

    try {
      const { team, created, addedEmployeeIds } = await upsertWorkbookTeam(
        workbookId!,
        teamId!,
        session.user.id,
        {
          quantity: body.quantity,
          dueOn: body.dueOn,
          links,
          notes: body.notes,
          employeeIds: body.employeeIds as string[] | undefined,
          status,
        },
      )

      const workbook = await db.projectWorkbook.findUnique({
        where: { id: workbookId },
        select: { name: true, periodMonth: true, project: { select: { name: true } } },
      })
      const month = formatMonth(workbook?.periodMonth?.toISOString().slice(0, 10) ?? null)

      await logActivity({
        projectId: projectId!,
        actorId: session.user.id,
        type: created ? "CALENDAR_TEAM_PLANNED" : "CALENDAR_TEAM_UPDATED",
        entityType: "workbookTeam",
        entityId: team.id,
        meta: {
          sheetName: workbook?.name ?? "a calendar",
          month,
          teamName: team.teamName,
          quantity: team.quantity,
          dueOn: team.dueOn,
        },
      })

      // Only people new to the row, and never the person doing it.
      const tell = addedEmployeeIds.filter((id) => id !== session.user.id)
      if (tell.length > 0) {
        await createNotifications(
          tell.map((employeeId) => ({
            employeeId,
            title: `You're on ${team.teamName} for ${month}`,
            message: `${workbook?.name ?? "A calendar"} in ${workbook?.project.name ?? "a project"}: ${
              team.quantity > 0 ? `${team.quantity} to deliver` : "your team's plan"
            }${team.dueOn ? `, due ${team.dueOn}` : ""}.`,
            type: "info" as const,
            link: `/projects/${projectId}?tab=calendar`,
          })),
        )
      }

      return NextResponse.json({ data: team })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not save that team's plan" },
        { status: 422 },
      )
    }
  },
)

// Files are detached, not deleted (FK ON DELETE SET NULL); the count comes back so the UI can say so.
export const DELETE = withWorkbookTeamAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, workbookId, teamId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    }

    const team = await db.projectTeam.findUnique({
      where: { id: teamId },
      select: { name: true },
    })
    const { detachedFiles } = await removeWorkbookTeam(workbookId!, teamId!)

    await logActivity({
      projectId: projectId!,
      actorId: session.user.id,
      type: "CALENDAR_TEAM_REMOVED",
      entityType: "workbookTeam",
      entityId: `${workbookId}:${teamId}`,
      meta: { teamName: team?.name ?? "A team", detachedFiles },
    })

    return NextResponse.json({ success: true, detachedFiles })
  },
)
