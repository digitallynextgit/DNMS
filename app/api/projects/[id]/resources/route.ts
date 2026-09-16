import { NextRequest, NextResponse } from "next/server"
import {
  canManageProject,
  resolveProjectId,
  withProjectAccess,
} from "@/features/projects/server/project-access"
import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { uploadFile, getObjectKey, ensureBucket } from "@/lib/storage"
import { uploadVideoAsset, VideoUploadError } from "@/lib/drive-media"
import { syncMadeCount, attachmentCount } from "@/lib/deliverable-counts"
import { isVideoUpload } from "@/lib/upload-rules"
import { classifyDoc, isDocTag } from "@/features/projects/lib/doc-tag"
import { canEditDeliverable } from "@/features/projects/server/deliverables.service"
import type { Session } from "next-auth"

const MAX_SIZE_BYTES = 250 * 1024 * 1024 // 250 MB
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
          // Null for a staff upload; set when the file arrived from the client
          // portal. isClientVisible and reviewStatus are scalars and ride along
          // with `include` automatically.
          uploadedByClient: { select: { id: true, name: true } },
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
      // The URL carries a slug now; this route is behind plain withSession, not
      // a slug-aware project guard, so resolve it here. The id is written onto
      // the stored resource, so an unresolved slug would corrupt the row.
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })

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
      const tagRaw = formData.get("tag")
      // A file can be the OUTPUT of a logged deliverable. It is still an
      // ordinary resource (so it shows on the Files tab), just linked back.
      const deliverableIdRaw = formData.get("deliverableId")
      const deliverableId =
        typeof deliverableIdRaw === "string" && deliverableIdRaw ? deliverableIdRaw : null

      // Files-tab folder to land in; absent/"null" = the project's top level.
      const folderIdRaw = formData.get("folderId")
      const folderId =
        typeof folderIdRaw === "string" && folderIdRaw && folderIdRaw !== "null"
          ? folderIdRaw
          : null

      // Normalise form values (FormData entries are FormDataEntryValue)
      const teamId =
        typeof teamIdRaw === "string" && teamIdRaw && teamIdRaw !== "null" ? teamIdRaw : null
      const category = typeof categoryRaw === "string" && categoryRaw ? categoryRaw : "OTHER"
      const description = typeof descriptionRaw === "string" ? descriptionRaw : null
      // An explicit tag wins; otherwise it is guessed from the file below, once
      // the name and MIME type are known. Never left null on a new upload - an
      // unclassified row is invisible to the tag filter, and the whole point of
      // guessing is that the filter covers everything.
      const explicitTag = isDocTag(tagRaw) ? tagRaw : null

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
          {
            error: `File exceeds the ${MAX_SIZE_BYTES / 1024 / 1024}MB limit (size: ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
          },
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

      // 8a. The folder, if any, must be one of this project's.
      if (folderId) {
        const folder = await db.projectFolder.findFirst({
          where: { id: folderId, projectId },
          select: { id: true },
        })
        if (!folder) {
          return NextResponse.json({ error: "Folder not found in this project" }, { status: 404 })
        }
      }

      // 8b. A deliverable link must name an entry on THIS project that the
      //     uploader may edit - their own, their team's, or they run the project.
      if (deliverableId) {
        const entry = await db.projectDeliverable.findFirst({
          where: { id: deliverableId, projectId },
          select: { projectId: true, employeeId: true, teamId: true, loggedById: true },
        })
        if (!entry) {
          return NextResponse.json(
            { error: "Deliverable not found in this project" },
            { status: 404 },
          )
        }
        if (!(await canEditDeliverable(session, entry))) {
          return NextResponse.json(
            { error: "You cannot attach files to that entry" },
            { status: 403 },
          )
        }
      }

      const resourceId = randomUUID()

      // 9. Pick the store. Video goes to Drive - the same rule the client portal
      //    applies - so a finished video has a link that can be sent to someone
      //    with no login here. Everything else stays on Backblaze.
      let storage: {
        objectKey: string | null
        driveFileId: string | null
        driveWebViewLink: string | null
        isPublicLink: boolean
        shareToken: string | null
        sharedPubliclyAt: Date | null
      }

      if (isVideoUpload({ name: fileName, type: file.type })) {
        try {
          const uploaded = await uploadVideoAsset(projectId, file)
          storage = {
            objectKey: null,
            driveFileId: uploaded.driveFileId,
            driveWebViewLink: uploaded.webViewLink,
            isPublicLink: true,
            shareToken: uploaded.shareToken,
            sharedPubliclyAt: new Date(),
          }
        } catch (e) {
          if (e instanceof VideoUploadError) {
            return NextResponse.json({ error: e.message }, { status: e.status })
          }
          console.error("[RESOURCES_POST] drive upload error:", e)
          const msg = e instanceof Error ? e.message : "Drive upload failed"
          return NextResponse.json({ error: msg }, { status: 500 })
        }
      } else {
        // Make sure the storage bucket exists (no-op if it already does)
        await ensureBucket()

        const prefix = teamId
          ? `projects/${projectId}/teams/${teamId}/${category}`
          : `projects/${projectId}/${category}`
        const objectKey = getObjectKey(prefix, fileName, resourceId)

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
        storage = {
          objectKey,
          driveFileId: null,
          driveWebViewLink: null,
          isPublicLink: false,
          shareToken: null,
          sharedPubliclyAt: null,
        }
      }

      // 12. DB record
      const resource = await db.projectResource.create({
        data: {
          id: resourceId,
          projectId,
          teamId,
          category: category as Category,
          tag: explicitTag ?? classifyDoc({ name: fileName, mimeType: file.type }),
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          ...storage,
          description: description?.trim() || null,
          uploadedById: session.user.id,
          deliverableId,
          folderId,
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          team: { select: { id: true, name: true } },
        },
      })

      // 12a. A file attached to a deliverable is work handed over, so "Made"
      //      moves with it - the same rule the portal applies, from lib so the
      //      two sides cannot drift. Read AFTER the insert, so the new row is
      //      included and `before` is one less.
      if (deliverableId) {
        const entry = await db.projectDeliverable.findUnique({
          where: { id: deliverableId },
          select: { id: true, quantity: true },
        })
        if (entry) {
          const after = await attachmentCount(deliverableId)
          await syncMadeCount(entry, after - 1, after)
        }
      }

      // 13. Audit log
      await createAuditLog(session, {
        action: "UPLOAD",
        module: "project",
        entityType: "ProjectResource",
        entityId: resource.id,
        changes: { fileName, fileSize: file.size, category, teamId, tag: resource.tag } as object,
      })

      return NextResponse.json({ data: resource }, { status: 201 })
    } catch (error) {
      console.error("[RESOURCES_POST]", error)
      const msg = error instanceof Error ? error.message : "Internal server error"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  },
)
