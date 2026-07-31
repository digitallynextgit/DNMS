import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  suggestKeywords,
  suggestCompetitors,
  explainSeo,
} from "@/features/seo/server/seo.ai.service"
import { AiError, AiNotConfiguredError, isAiConfigured } from "@/lib/ai"
import type { Session } from "next-auth"

// AI assistance for SEO config. Suggestions only - nothing is saved here; the
// human picks what to keep and saves via the normal site-settings route.
export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  task: z.enum(["keywords", "competitors", "explain"]),
})

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId: id },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    if (!isAiConfigured())
      return NextResponse.json(
        { error: "AI is not configured. An admin needs to set MISTRAL_API_KEY." },
        { status: 503 },
      )

    const { task } = bodySchema.parse(await req.json())

    try {
      if (task === "keywords")
        return NextResponse.json({ data: { keywords: await suggestKeywords(propertyId!) } })
      if (task === "competitors")
        return NextResponse.json({ data: { competitors: await suggestCompetitors(propertyId!) } })
      return NextResponse.json({ data: { text: await explainSeo(propertyId!) } })
    } catch (err) {
      // AI being down must never look like a broken page.
      if (err instanceof AiNotConfiguredError)
        return NextResponse.json({ error: "AI is not configured." }, { status: 503 })
      if (err instanceof AiError)
        return NextResponse.json({ error: err.message }, { status: err.status ?? 502 })
      throw err
    }
  },
)
