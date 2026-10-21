import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { deleteTaskWorkLog } from "@/features/projects/server/task-work-logs.service"
import { AppError } from "@/lib/errors"

// Take a work log back: its author for a week, managers any time. Units it added come off the
// deliverable while that is still owed.
export const DELETE = withSession(
  async (
    _req: NextRequest,
    ctx: { params: Promise<{ id: string; logId: string }> },
    session: Session,
  ) => {
    const { id, logId } = await ctx.params
    try {
      await deleteTaskWorkLog(session, id, logId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
