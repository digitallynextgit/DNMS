import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// Proves the item belongs to the task in the URL and the caller may access its project.
// Returns the item id, or a NextResponse to return on failure.
async function authorizeChecklistItem(
  taskId: string,
  itemId: string,
  session: Session,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const item = await db.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: { taskId: true, task: { select: { projectId: true } } },
  })
  if (!item || item.taskId !== taskId) {
    return { ok: false, res: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }
  // Adhoc tasks (no project) are open to any staffer; project tasks need project access.
  if (item.task.projectId && !(await canAccessProject(session, item.task.projectId))) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: taskId, itemId } = ctx.params
      const auth = await authorizeChecklistItem(taskId, itemId, session)
      if (!auth.ok) return auth.res

      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (typeof body.isChecked === "boolean") data.isChecked = body.isChecked
      if (body.text?.trim()) data.text = body.text.trim()
      const item = await db.taskChecklistItem.update({ where: { id: itemId }, data })
      return NextResponse.json({ data: item })
    } catch (error) {
      console.error("[CHECKLIST_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: taskId, itemId } = ctx.params
      const auth = await authorizeChecklistItem(taskId, itemId, session)
      if (!auth.ok) return auth.res

      await db.taskChecklistItem.delete({ where: { id: itemId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[CHECKLIST_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
