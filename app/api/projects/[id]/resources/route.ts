import { NextRequest, NextResponse } from "next/server"
import { canManageProject, withProjectAccess } from "@/features/projects/server/project-access"
import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { uploadFile, getObjectKey, ensureBucket } from "@/lib/storage"
import type { Session } from "next-auth"

const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".sh", ".cmd", ".msi", ".com", ".scr", ".ps1"]
const ALLOWED_CATEGORIES = ["BRIEFS", "ASSETS", "DELIVERABLES", "REFERENCES", "OTHER"] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]

// Project participant check (any team member, or owner)
async function isProjectParticipant(projectId: string, employeeId: string): Promise<boolean> {
  const m = await db.projectTeamMember.findFirst({
    where: { projectId, employeeId },
    select: { id: true },
  })
  if (m) return true
  const p = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } })
  return p?.ownerId === employeeId
}

// Helper: pull a file extension safely. "myfile.pdf" → ".pdf"; "README" → ""; "x.tar.gz" → ".gz"
function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".")
  if (idx < 0 || idx === name.length - 1) return ""
  return name.slice(idx).toLowerCase()
}

// GET /api/projects/[id]/resources - list resources (filterable)
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = ctx.params
      const { searchParams } = new URL(req.url)
      const teamFilter = searchParams.get("teamId")
      const categoryFilter = searchParams.get("category")

      const where: Record<string, unknown> = { projectId }
      if (teamFilter === "null") where.teamId = null
      else if (teamFilter) where.teamId = teamFilter
      if (categoryFilter) where.category = categoryFilter

      const resources = await db.projectResource.findMany({
        where,
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ data: resources })
    } catch (error) {
      console.error("[RESOURCES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/resources - upload file (multipart/form-data)
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = ctx.params

      // 1. Verify project exists
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      })
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }

      // 2. Auth: project participant OR admin
      const isAdmin = await canManageProject(session, projectId)
      const isParticipant = isAdmin || (await isProjectParticipant(projectId, session.user.id))
      if (!isParticipant) {
        return NextResponse.json(
          { error: "You must be a project participant to upload resources" },
          { status: 403 },
        )
      }

      // 3. Parse form data
      let formData: FormData
      try {
        formData = await req.formData()
      } catch (e) {
        console.error("[RESOURCES_POST] formData parse error:", e)
        return NextResponse.json({ error: "Could not read uploaded data" }, { status: 400 })
      }

      const fileEntry = formData.get("file")
      const teamIdRaw = formData.get("teamId")
      const categoryRaw = formData.get("category")
      const descriptionRaw = formData.get("description")

      // Normalise form values (FormData entries are FormDataEntryValue)
      const teamId =
        typeof teamIdRaw === "string" && teamIdRaw && teamIdRaw !== "null" ? teamIdRaw : null
      const category = typeof categoryRaw === "string" && categoryRaw ? categoryRaw : "OTHER"
      const description = typeof descriptionRaw === "string" ? descriptionRaw : null

      // 4. Validate file
      if (!fileEntry || typeof fileEntry === "string") {
        return NextResponse.json({ error: "File is required" }, { status: 400 })
      }
      const file = fileEntry as File
      if (!file.size || file.size === 0) {
        return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 })
      }

      // 5. Validate category
      if (!ALLOWED_CATEGORIES.includes(category as Category)) {
        return NextResponse.json({ error: `Invalid category "${category}"` }, { status: 400 })
      }

      // 6. Size check
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File exceeds 100MB limit (size: ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
          { status: 413 },
        )
      }

      // 7. Extension check
      const fileName = file.name || "upload"
      const ext = fileExtension(fileName)
      if (ext && BLOCKED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Files with extension ${ext} are not allowed for security reasons` },
          { status: 415 },
        )
      }

      // 8. Validate team belongs to project, if provided
      if (teamId) {
        const team = await db.projectTeam.findUnique({ where: { id: teamId } })
        if (!team || team.projectId !== projectId) {
          return NextResponse.json({ error: "Team not found in this project" }, { status: 404 })
        }
      }

      // 9. Make sure the storage bucket exists (no-op if it already does)
      await ensureBucket()

      // 10. Build storage path
      const prefix = teamId
        ? `projects/${projectId}/teams/${teamId}/${category}`
        : `projects/${projectId}/${category}`

      const resourceId = randomUUID()
      const objectKey = getObjectKey(prefix, fileName, resourceId)

      // 11. Read into buffer and upload
      let buffer: Buffer
      try {
        const arrayBuf = await file.arrayBuffer()
        buffer = Buffer.from(arrayBuf)
      } catch (e) {
        console.error("[RESOURCES_POST] file read error:", e)
        return NextResponse.json({ error: "Could not read file contents" }, { status: 400 })
      }

      try {
        await uploadFile(objectKey, buffer, file.type || "application/octet-stream", file.size)
      } catch (e) {
        console.error("[RESOURCES_POST] storage upload error:", e)
        const msg = e instanceof Error ? e.message : "Storage upload failed"
        return NextResponse.json({ error: msg }, { status: 500 })
      }

      // 12. DB record
      const resource = await db.projectResource.create({
        data: {
          id: resourceId,
          projectId,
          teamId,
          category: category as Category,
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          objectKey,
          description: description?.trim() || null,
          uploadedById: session.user.id,
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          team: { select: { id: true, name: true } },
        },
      })

      // 13. Audit log
      await createAuditLog(session, {
        action: "UPLOAD",
        module: "project",
        entityType: "ProjectResource",
        entityId: resource.id,
        changes: { fileName, fileSize: file.size, category, teamId } as object,
      })

      return NextResponse.json({ data: resource }, { status: 201 })
    } catch (error) {
      console.error("[RESOURCES_POST]", error)
      const msg = error instanceof Error ? error.message : "Internal server error"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  },
)
