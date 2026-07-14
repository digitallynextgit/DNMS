import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getSignedUrl, deleteFile } from "@/lib/storage"

// GET - redirect to a short-lived signed download URL for the asset.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const asset = await db.brandAsset.findUnique({ where: { id: ctx.params.assetId } })
    if (!asset || asset.projectId !== ctx.params.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    const url = await getSignedUrl(asset.objectKey, 900, { downloadFileName: asset.fileName })
    return NextResponse.redirect(url)
  },
)

// DELETE - remove the asset from storage + DB.
export const DELETE = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const asset = await db.brandAsset.findUnique({ where: { id: ctx.params.assetId } })
    if (!asset || asset.projectId !== ctx.params.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    await deleteFile(asset.objectKey).catch(() => {})
    await db.brandAsset.delete({ where: { id: asset.id } })
    return NextResponse.json({ data: { ok: true } })
  },
)
