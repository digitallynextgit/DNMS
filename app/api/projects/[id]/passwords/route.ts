import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { encrypt } from "@/lib/crypto"
import type { Session } from "next-auth"

const CREATOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
}

// Manager-only: a client's live logins aren't for every member. The list never includes the password.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const entries = await db.projectPasswordEntry.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          label: true,
          username: true,
          url: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: CREATOR_SELECT },
        },
      })
      return NextResponse.json({ data: entries })
    } catch (error) {
      console.error("[PASSWORDS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const body = await req.json()
      const label = body.label?.trim()
      const password = body.password?.trim()
      if (!label || !password) {
        return NextResponse.json({ error: "Label and password are required" }, { status: 400 })
      }

      const entry = await db.projectPasswordEntry.create({
        data: {
          projectId,
          label,
          username: body.username?.trim() || null,
          encPassword: encrypt(password),
          url: body.url?.trim() || null,
          notes: body.notes?.trim() || null,
          createdById: session.user.id,
        },
        select: {
          id: true,
          label: true,
          username: true,
          url: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: CREATOR_SELECT },
        },
      })

      return NextResponse.json({ data: entry }, { status: 201 })
    } catch (error) {
      console.error("[PASSWORDS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
