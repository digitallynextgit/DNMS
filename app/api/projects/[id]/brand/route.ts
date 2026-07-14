import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

// GET - the project's brand/strategy workspace (brief, overview, objectives,
// manifestation, guidelines) + uploaded assets with signed download URLs.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const projectId = ctx.params.id
      const [brand, assets] = await Promise.all([
        db.projectBrand.findUnique({ where: { projectId } }),
        db.brandAsset.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
      ])
      const withUrls = await Promise.all(
        assets.map(async (a) => ({
          id: a.id,
          kind: a.kind,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          url: await getSignedUrl(a.objectKey, 3600).catch(() => ""),
          createdAt: a.createdAt.toISOString(),
        })),
      )
      return NextResponse.json({
        data: {
          brief: brand?.brief ?? null,
          overview: brand?.overview ?? null,
          objectives: brand?.objectives ?? [],
          manifestation: brand?.manifestation ?? {},
          guidelines: brand?.guidelines ?? { colors: [], fonts: "", logoNotes: "", uiux: "" },
          assets: withUrls,
        },
      })
    } catch (error) {
      console.error("[PROJECT_BRAND_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PUT - upsert the brand text/JSON sections (assets are handled separately).
export const PUT = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const projectId = ctx.params.id
      const body = await req.json().catch(() => null)
      if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

      // PARTIAL update: only the sections actually sent are touched, so each
      // section of the Brand tab can be saved on its own without clobbering the
      // others.
      const data: Record<string, unknown> = {}
      if ("brief" in body) data.brief = typeof body.brief === "string" ? body.brief : null
      if ("overview" in body)
        data.overview = typeof body.overview === "string" ? body.overview : null
      if ("objectives" in body) data.objectives = (body.objectives ?? []) as object
      if ("manifestation" in body) data.manifestation = (body.manifestation ?? {}) as object
      if ("guidelines" in body) data.guidelines = (body.guidelines ?? {}) as object

      await db.projectBrand.upsert({
        where: { projectId },
        update: data,
        create: { projectId, ...data },
      })
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[PROJECT_BRAND_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
