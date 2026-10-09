import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { ensureServiceCalendars } from "@/features/projects/server/service-calendars"
import type { Session } from "next-auth"

// Body: { service: "SEO" } - starts that service's calendar (this month) if it has none yet.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id
      const body = (await req.json()) as { service?: string }
      const service = typeof body.service === "string" ? body.service : ""
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { services: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      if (!project.services.includes(service)) {
        return NextResponse.json(
          { error: "Tick this service on the project first." },
          { status: 422 },
        )
      }
      const created = await ensureServiceCalendars(projectId, session.user.id, service)
      return NextResponse.json({ data: { created } })
    } catch (error) {
      console.error("[PROJECT_SERVICE_CALENDAR_POST]", error)
      return NextResponse.json({ error: "Could not create the calendar" }, { status: 500 })
    }
  },
)
