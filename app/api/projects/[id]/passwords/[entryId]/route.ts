import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { canManageProject, withProjectManager } from "@/features/projects/server/project-access"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// The reveal endpoint - returns the decrypted password. Every reveal is audited: project admins can
// open every client's logins, so who saw which one must stay answerable.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Scope to the guarded project, so another project's entry id 404s instead of being decrypted.
      const entry = await db.projectPasswordEntry.findFirst({
        where: { id: entryId, projectId },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await createAuditLog(session, {
        action: "REVEAL",
        module: "project",
        entityType: "ProjectPasswordEntry",
        entityId: entry.id,
        changes: { projectId, label: entry.label },
      })
      return NextResponse.json({ data: { password: tryDecrypt(entry.encPassword) ?? "" } })
    } catch (error) {
      console.error("[PASSWORD_REVEAL]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Bind to the guarded project first, or a manager of project A could edit B's entry.
      const entry = await db.projectPasswordEntry.findFirst({
        where: { id: entryId, projectId },
        select: { id: true, createdById: true, label: true },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const isAdmin = await canManageProject(session, projectId)
      if (entry.createdById !== session.user.id && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (body.label?.trim()) data.label = body.label.trim()
      if (body.username !== undefined) data.username = body.username?.trim() || null
      if (body.password?.trim()) data.encPassword = encrypt(body.password.trim())
      if (body.url !== undefined) data.url = body.url?.trim() || null
      if (body.notes !== undefined) data.notes = body.notes?.trim() || null

      const updated = await db.projectPasswordEntry.update({
        where: { id: entryId },
        data,
        select: {
          id: true,
          label: true,
          username: true,
          url: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      })
      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectPasswordEntry",
        entityId: entryId,
        // Which fields changed, never their values.
        changes: { projectId, label: entry.label, fields: Object.keys(data) },
      })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PASSWORD_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      const entry = await db.projectPasswordEntry.findFirst({
        where: { id: entryId, projectId },
        select: { id: true, createdById: true, label: true },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const isAdmin = await canManageProject(session, projectId)
      if (entry.createdById !== session.user.id && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      await db.projectPasswordEntry.delete({ where: { id: entryId } })
      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectPasswordEntry",
        entityId: entryId,
        changes: { projectId, label: entry.label },
      })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PASSWORD_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
