import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { canManageProject, withProjectManager } from "@/features/projects/server/project-access"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import type { Session } from "next-auth"

// The reveal endpoint - returns the decrypted password.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Scope to the guarded project, so another project's entry id 404s instead of being decrypted.
      const entry = await db.projectPasswordEntry.findFirst({
        where: { id: entryId, projectId },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
        select: { id: true, createdById: true },
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
        select: { id: true, createdById: true },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const isAdmin = await canManageProject(session, projectId)
      if (entry.createdById !== session.user.id && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      await db.projectPasswordEntry.delete({ where: { id: entryId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PASSWORD_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
