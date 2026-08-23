import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import {
  canManageProject,
  withProjectAccess,
  withProjectManager,
} from "@/features/projects/server/project-access"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import type { Session } from "next-auth"

// GET /api/projects/[id]/passwords/[entryId] - returns decrypted password
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Scope to the guarded project: withProjectAccess only proved access to
      // THIS project, so an entry id from another project must 404 here rather
      // than have its password decrypted (SEC-02).
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

// PATCH /api/projects/[id]/passwords/[entryId]
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Bind the entry to the authorized project BEFORE the ownership check -
      // otherwise a manager of project A could edit project B's entry (SEC-02).
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

// DELETE /api/projects/[id]/passwords/[entryId]
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, entryId } = ctx.params
      // Bind to the authorized project first (SEC-02).
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
