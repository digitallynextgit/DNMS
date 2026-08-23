import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

/**
 * Resolve a checklist item, prove it belongs to the task in the URL, and prove
 * the caller may act on that task's project (API-06). Previously these handlers
 * read only itemId with no access check and ignored the taskId segment, so any
 * signed-in staffer could toggle or delete any task's checklist items.
 *
 * Returns the item id on success, or a NextResponse to return on failure.
 */
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
  // An adhoc task (no project) is reachable by any signed-in staffer, matching
  // the rest of the tasks surface; a project task requires project access.
  if (item.task.projectId && !(await canAccessProject(session, item.task.projectId))) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

// PATCH /api/tasks/[id]/checklist/[itemId]
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

// DELETE /api/tasks/[id]/checklist/[itemId]
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
