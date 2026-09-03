import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { BRAND_ASSET_KINDS } from "@/features/projects/brand"
import { uploadFile, getObjectKey, ensureBucket } from "@/lib/storage"
import type { Session } from "next-auth"

const MAX_BYTES = 250 * 1024 * 1024 // 250 MB
const MAX_LABEL = "250 MB"
const BLOCKED = ["exe", "bat", "cmd", "sh", "msi", "com", "scr", "js", "jar", "vbs"]

/** Which Strategy section the file hangs off. See features/projects/brand.ts. */
const KINDS: ReadonlySet<string> = new Set(BRAND_ASSET_KINDS)

// POST - upload a brand file (kind = "BRIEF" | "LOGO"). multipart/form-data.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id
      const form = await req.formData().catch(() => null)
      if (!form) return NextResponse.json({ error: "Could not read upload" }, { status: 400 })

      const file = form.get("file")
      const kind = String(form.get("kind") || "LOGO").toUpperCase()
      if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
      // Rejected rather than defaulted: a row stored under an unknown kind is
      // invisible on every section of the page, so the upload would report
      // success and the file would simply never appear again.
      if (!KINDS.has(kind))
        return NextResponse.json({ error: `Unknown file section "${kind}"` }, { status: 400 })
      if (file.size > MAX_BYTES)
        return NextResponse.json({ error: `File too large (max ${MAX_LABEL})` }, { status: 413 })

      const fileName = file.name || "upload"
      const ext = fileName.split(".").pop()?.toLowerCase()
      if (ext && BLOCKED.includes(ext))
        return NextResponse.json({ error: `.${ext} files are not allowed` }, { status: 415 })

      await ensureBucket()
      const assetId = randomUUID()
      const objectKey = getObjectKey(
        `projects/${projectId}/brand/${kind.toLowerCase()}`,
        fileName,
        assetId,
      )
      const buffer = Buffer.from(await file.arrayBuffer())
      await uploadFile(objectKey, buffer, file.type || "application/octet-stream", file.size)

      const asset = await db.brandAsset.create({
        data: {
          id: assetId,
          projectId,
          kind,
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          objectKey,
          uploadedById: session.user.id,
        },
      })
      return NextResponse.json({ data: { id: asset.id } }, { status: 201 })
    } catch (error) {
      console.error("[BRAND_ASSET_POST]", error)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
  },
)
