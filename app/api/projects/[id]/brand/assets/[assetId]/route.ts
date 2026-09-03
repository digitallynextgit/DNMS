import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { getSignedUrl, deleteFile } from "@/lib/storage"

// GET - redirect to a short-lived signed download URL for the asset.
//
// withProjectAccess for the same reason as the parent route: the ownership check
// below compares `asset.projectId` (a uuid) against `ctx.params.id`, and under
// withAuth that was the URL slug - so every asset looked like it belonged to
// another project and 404'd.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const asset = await db.brandAsset.findUnique({ where: { id: ctx.params.assetId } })
    if (!asset || asset.projectId !== ctx.params.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    const url = await getSignedUrl(asset.objectKey, 900, { downloadFileName: asset.fileName })
    return NextResponse.redirect(url)
  },
)

// DELETE - remove the asset from storage + DB.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const asset = await db.brandAsset.findUnique({ where: { id: ctx.params.assetId } })
    if (!asset || asset.projectId !== ctx.params.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    await deleteFile(asset.objectKey).catch(() => {})
    await db.brandAsset.delete({ where: { id: asset.id } })
    return NextResponse.json({ data: { ok: true } })
  },
)
