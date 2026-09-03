import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

// GET - the project's brand/strategy workspace (brief, overview, objectives,
// manifestation, guidelines) + uploaded assets with signed download URLs.
//
// withProjectAccess, NOT withAuth. Two things were wrong with withAuth here and
// they compounded:
//
//   1. Project URLs are SLUGS (/projects/happy-ganga). withProjectAccess and
//      withProjectManager resolve `ctx.params.id` to the real uuid; withAuth
//      does not. So the write routes stored assets against the uuid while THIS
//      route queried for the slug - every upload saved correctly and then came
//      back empty, along with the brief and every other saved section.
//   2. It demanded the global `project:read`, so a team member on the project
//      could open every other tab and not this one. Every other project read
//      uses withProjectAccess, which is membership-based.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const projectId = ctx.params.id!
      const [brand, assets] = await Promise.all([
        db.projectBrand.findUnique({ where: { projectId } }),
        db.brandAsset.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
      ])
      const withUrls = await Promise.all(
        assets.map(async (a) => {
          const [url, downloadUrl] = await Promise.all([
            // `url` opens inline (View); `downloadUrl` carries a content-disposition
            // header so the browser saves it under its real name (Download).
            getSignedUrl(a.objectKey, 3600).catch(() => ""),
            getSignedUrl(a.objectKey, 3600, { downloadFileName: a.fileName }).catch(() => ""),
          ])
          return {
            id: a.id,
            kind: a.kind,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            url,
            downloadUrl,
            createdAt: a.createdAt.toISOString(),
          }
        }),
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
export const PUT = withProjectManager(
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
