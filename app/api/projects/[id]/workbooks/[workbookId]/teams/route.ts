import { NextRequest, NextResponse } from "next/server"

import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  listWorkbookTeams,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"

/**
 * GET - the team plan for one month's calendar, in catalogue order.
 *
 * READABLE BY ANYONE ON THE PROJECT, unlike the writes beside it. The whole
 * point of the plan is that somebody on the video team can see what video owes
 * this month and by when without asking; a plan only its managers could read
 * would be a worse version of the chat thread it replaces.
 *
 * It is also served inside GET /workbooks/[workbookId], so the panel needs no
 * second request on load. This exists for refetching the plan alone.
 */
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Calendar not found" }, { status: 404 })
    }
    return NextResponse.json({ data: await listWorkbookTeams(workbookId!) })
  },
)
