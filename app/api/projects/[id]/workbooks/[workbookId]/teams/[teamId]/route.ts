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

/**
 * The team-plan surface, keyed on (calendar, team) rather than on the plan
 * row's own id.
 *
 * That pair is the row's natural key - the six teams are a fixed catalogue, so
 * a team is on a calendar once or not at all - which means there is nothing to
 * create-then-fetch, and, more importantly, the GUARD can read the team out of
 * the URL. A guard cannot read the body to find out which team is being edited
 * without consuming the stream the handler then needs.
 *
 * withWorkbookTeamAccess: project admin, Account Manager, the calendar's
 * manager (any team), or that team's own manager (only their row).
 */

const MAX_LINKS = 20

/**
 * PUT - put a team on the plan, or change what it owes. Idempotent.
 *   body { quantity?, dueOn?, links?, notes?, employeeIds? }
 *
 * One write for the whole row, because that is how the form is filled in. Any
 * omitted field is left alone, so the same call serves "add VIDEO" and "move
 * VIDEO's deadline".
 *
 * ── TWO PERMISSION LEVELS IN ONE ROUTE ───────────────────────────────────────
 * The guard admits anyone who may hand work in - including a plain member of
 * that team, which is the point of the plan living on the calendar. The
 * PLANNING fields are then gated separately, inside:
 *
 *   quantity / dueOn / employeeIds   account manager, project admin, the
 *                                    calendar's manager, or that team's manager
 *   links / files / status           anyone on that team
 *
 * A member deciding their own deadline or their own target would make the plan
 * a suggestion. A member who cannot record what they delivered makes it
 * paperwork somebody else has to do for them.
 */
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

    // Links are validated here rather than in the service because this is where
    // untrusted input arrives. Same rule as task links and deliverable links:
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

    // The planning fields. Asking only when one of them is actually present
    // keeps the extra lookup off the path a team member takes to upload a file.
    const plans =
      body.quantity !== undefined ||
      body.dueOn !== undefined ||
      body.employeeIds !== undefined ||
      // Dropping the work is a planning decision, not a progress report - a
      // team member may say STUCK, but not that it is no longer owed.
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

      // Only people NEW to the row, and never the person doing it. Someone who
      // was already on it does not need telling again because the quantity
      // moved - that is what the calendar itself is for.
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

/**
 * DELETE - take a team off this month's plan.
 *
 * Its files are DETACHED, not deleted (the FK is ON DELETE SET NULL): they stay
 * in the project's Files. Taking a team off a plan is an editing decision, and
 * destroying work they already handed over is not something a planning panel
 * should be able to do. The count comes back so the UI can say so.
 */
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
