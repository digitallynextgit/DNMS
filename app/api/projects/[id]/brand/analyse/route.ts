import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectManager } from "@/features/projects/server/project-access"
import { analyseBrandDocuments } from "@/features/projects/server/brand-ai.service"
import { AiError, AiNotConfiguredError } from "@/lib/ai"
import { createAuditLog } from "@/lib/audit"

// POST /api/projects/[id]/brand/analyse  body { assetIds?: string[] }
// Draft a brand brief + recommendations from the uploaded brief documents.
// Same guard as saving the brief (withProjectManager): the result is meant to
// be pasted into that field. Nothing is stored; the client applies it.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as { assetIds?: unknown }
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((x): x is string => typeof x === "string" && x.length > 0)
      : undefined
    try {
      const data = await analyseBrandDocuments(ctx.params.id, assetIds)
      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "BrandBriefDraft",
        entityId: ctx.params.id,
        changes: {
          files: data.sources.filter((s) => s.status === "read").map((s) => s.fileName),
        },
      })
      return NextResponse.json({ data })
    } catch (error) {
      // "AI is down" must never read as "the brief is broken": map the AI
      // layer's errors to statuses the client can explain. Everything else
      // (unknown project, unreadable documents) is an AppError and falls
      // through to withSession's funnel.
      if (error instanceof AiNotConfiguredError) {
        return NextResponse.json(
          { error: "AI is not configured on the server (MISTRAL_API_KEY is missing)" },
          { status: 503 },
        )
      }
      if (error instanceof AiError) {
        const status = error.status === 429 ? 429 : 502
        return NextResponse.json({ error: error.message }, { status })
      }
      throw error
    }
  },
)
