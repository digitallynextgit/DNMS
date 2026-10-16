import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  canManageSheetIntake,
  getSheetIntake,
  issueSheetIntake,
} from "@/features/projects/server/sheet-intake.service"

// A tab's API link and secret (tab ... menu -> API access). The project's managers and the
// calendar's owners only: the secret lets anyone holding it add rows.

async function denied(session: Session, projectId: string, sheetId: string) {
  if (await canManageSheetIntake(session, projectId, sheetId)) return null
  return NextResponse.json(
    { error: "Only the project's managers and this calendar's owners can see its API" },
    { status: 403 },
  )
}

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    const no = await denied(session, projectId!, sheetId!)
    if (no) return no
    return NextResponse.json({ data: await getSheetIntake(projectId!, sheetId!) })
  },
)

/** Create the tab's API, or replace its secret (the old one stops working at once). */
export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, sheetId } = ctx.params
    const no = await denied(session, projectId!, sheetId!)
    if (no) return no
    try {
      return NextResponse.json({
        data: await issueSheetIntake(projectId!, sheetId!, session.user.id),
      })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not create the API" },
        { status: 422 },
      )
    }
  },
)
