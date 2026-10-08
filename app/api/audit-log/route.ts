import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Prisma } from "@prisma/client"

export const GET = withAuth(PERMISSIONS.AUDIT_READ, async (req: NextRequest) => {
  const { searchParams } = req.nextUrl

  const { page, limit, skip } = resolvePagination(
    { page: searchParams.get("page"), limit: searchParams.get("limit") },
    20,
  )

  const moduleFilter = searchParams.get("module") ?? undefined
  const actorIdFilter = searchParams.get("actorId") ?? undefined
  const actionFilter = searchParams.get("action") ?? undefined
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  const where: Prisma.AuditLogWhereInput = {}

  if (moduleFilter) {
    where.module = moduleFilter
  }

  if (actorIdFilter) {
    where.actorId = actorIdFilter
  }

  if (actionFilter) {
    where.action = { contains: actionFilter, mode: "insensitive" }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) {
      const from = new Date(dateFrom)
      if (!isNaN(from.getTime())) {
        ;(where.createdAt as Prisma.DateTimeFilter).gte = from
      }
    }
    if (dateTo) {
      // Include the whole dateTo day.
      const to = new Date(dateTo)
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999)
        ;(where.createdAt as Prisma.DateTimeFilter).lte = to
      }
    }
  }

  const [total, entries] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        actor: {
          select: EMPLOYEE_SUMMARY_SELECT,
        },
      },
    }),
  ])

  return NextResponse.json({
    data: entries,
    pagination: paginationMeta(total, page, limit),
  })
})
