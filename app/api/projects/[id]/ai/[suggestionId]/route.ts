import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { acceptSuggestion } from "@/features/projects/server/ai-planning.service"
import { AppError } from "@/lib/errors"

// Marks an AI draft as used (someone filled a form from it), for the record of what AI changed.
export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      await acceptSuggestion(ctx.params.id!, ctx.params.suggestionId!, session.user.id)
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
