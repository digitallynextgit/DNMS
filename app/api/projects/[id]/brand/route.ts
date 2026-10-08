import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

// withProjectAccess, not withAuth: it resolves the slug to the uuid assets are stored under, and it
// is membership-based like every other project read.
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
            // `url` opens inline; `downloadUrl` saves under the real name.
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

export const PUT = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const projectId = ctx.params.id
      const body = await req.json().catch(() => null)
      if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

      // Partial update: only the sections sent are touched.
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
