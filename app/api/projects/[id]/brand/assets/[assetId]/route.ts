import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { getSignedUrl, deleteFile } from "@/lib/storage"

// withProjectAccess resolves the slug to the project uuid that the ownership check compares against.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const asset = await db.brandAsset.findUnique({ where: { id: ctx.params.assetId } })
    if (!asset || asset.projectId !== ctx.params.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    const url = await getSignedUrl(asset.objectKey, 900, { downloadFileName: asset.fileName })
    return NextResponse.redirect(url)
  },
)

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
