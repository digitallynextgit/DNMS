import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import type { Session } from "next-auth"

// GET - paginated notifications for the current user
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { searchParams } = new URL(req.url)
      const { page, limit, skip, take } = resolvePagination(
        { page: searchParams.get("page"), limit: searchParams.get("limit") },
        20,
      )
      const unreadParam = searchParams.get("unread")

      const employeeId = session.user.id

      // Badge shortcut: unread=true & limit=1 → return just the count
      if (unreadParam === "true" && limit === 1) {
        const unreadCount = await db.notification.count({
          where: { employeeId, isRead: false },
        })
        return NextResponse.json({ unreadCount })
      }

      const where: Record<string, unknown> = { employeeId }
      if (unreadParam === "true") {
        where.isRead = false
      }

      const [notifications, total] = await Promise.all([
        db.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.notification.count({ where }),
      ])

      return NextResponse.json({
        data: notifications,
        meta: paginationMeta(total, page, limit),
      })
    } catch (error) {
      console.error("[notifications/inbox] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PATCH - mark notifications as read
export const PATCH = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const employeeId = session.user.id

      if (body.all === true) {
        await db.notification.updateMany({
          where: { employeeId, isRead: false },
          data: { isRead: true, readAt: new Date() },
        })
        return NextResponse.json({ data: { success: true } })
      }

      if (Array.isArray(body.ids) && body.ids.length > 0) {
        // Validate ownership before updating
        const owned = await db.notification.findMany({
          where: { id: { in: body.ids }, employeeId },
          select: { id: true },
        })
        const ownedIds = owned.map((n) => n.id)

        if (ownedIds.length > 0) {
          await db.notification.updateMany({
            where: { id: { in: ownedIds } },
            data: { isRead: true, readAt: new Date() },
          })
        }

        return NextResponse.json({ data: { updated: ownedIds.length } })
      }

      return NextResponse.json({ error: "Provide 'ids' array or 'all: true'" }, { status: 400 })
    } catch (error) {
      console.error("[notifications/inbox] PATCH error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
