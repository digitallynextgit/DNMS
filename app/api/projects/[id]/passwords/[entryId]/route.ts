import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// GET /api/projects/[id]/passwords/[entryId] - returns decrypted password
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ entryId: string }> }, _session: Session) => {
    try {
      const { entryId } = await ctx.params
      const entry = await db.projectPasswordEntry.findUnique({ where: { id: entryId } })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: { password: tryDecrypt(entry.encPassword) ?? "" } })
    } catch (error) {
      console.error("[PASSWORD_REVEAL]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PATCH /api/projects/[id]/passwords/[entryId]
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ entryId: string }> }, session: Session) => {
    try {
      const { entryId } = await ctx.params
      const entry = await db.projectPasswordEntry.findUnique({
        where: { id: entryId },
        select: { id: true, createdById: true },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
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
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ entryId: string }> }, session: Session) => {
    try {
      const { entryId } = await ctx.params
      const entry = await db.projectPasswordEntry.findUnique({
        where: { id: entryId },
        select: { id: true, createdById: true },
      })
      if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
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
