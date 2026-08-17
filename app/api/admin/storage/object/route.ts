import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { deleteStorageObject, getStorageOverview } from "@/features/storage/server/storage.service"
import { getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

// DELETE /api/admin/storage/object
//   body { key }            -> delete one object (and clear its DB reference)
//   body { orphansOnly:true }-> delete every orphaned object in one go
export const DELETE = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = (await req.json().catch(() => ({}))) as { key?: string; orphansOnly?: boolean }

      if (body.orphansOnly) {
        const overview = await getStorageOverview()
        const orphans = overview.files.filter((f) => !f.referenced)
        for (const f of orphans) await deleteStorageObject(f.key)
        return NextResponse.json({
          data: { deleted: orphans.length, message: `Deleted ${orphans.length} orphaned file(s).` },
        })
      }

      if (!body.key) return NextResponse.json({ error: "key is required" }, { status: 400 })
      const { name } = await deleteStorageObject(body.key)
      return NextResponse.json({ data: { message: `Deleted "${name}".` } })
    } catch (error) {
      console.error("[ADMIN_STORAGE_DELETE]", error)
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }
  },
)

// GET /api/admin/storage/object?key=...&download=1
//
// One signed URL, minted when somebody actually clicks View or Download. The
// overview used to embed two per row for every file in the bucket; almost all of
// them were never followed.
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    const key = req.nextUrl.searchParams.get("key")
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 })

    const download = req.nextUrl.searchParams.get("download") === "1"
    const name = key.split("/").pop() ?? "file"
    try {
      const url = await getSignedUrl(key, 3600, download ? { downloadFileName: name } : undefined)
      // Redirect rather than return JSON, so the link can be a plain href and the
      // browser handles the download exactly as it did before.
      return NextResponse.redirect(url, { status: 302 })
    } catch (error) {
      console.error("[ADMIN_STORAGE_OBJECT_GET]", error)
      return NextResponse.json({ error: "Could not open that file" }, { status: 500 })
    }
  },
)
