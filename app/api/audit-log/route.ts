/**
 * GET /api/audit-log
 *
 * Returns a paginated, filterable list of audit log entries with the
 * acting employee's basic profile attached.
 *
 * Query parameters (all optional):
 *   page      – page number, 1-based (default: 1)
 *   limit     – entries per page (default: 20, max: 100)
 *   module    – filter by module string (exact match)
 *   actorId   – filter by the actor's employee id
 *   action    – filter by action string (contains, case-insensitive)
 *   dateFrom  – ISO-8601 date; only entries on/after this date
 *   dateTo    – ISO-8601 date; only entries on/before this date
 *
 * Response shape:
 * {
 *   data: AuditLog[],
 *   pagination: { page, limit, total, totalPages }
 * }
 *
 * Requires AUDIT_READ permission.
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Prisma } from "@prisma/client"

export const GET = withAuth(PERMISSIONS.AUDIT_READ, async (req: NextRequest) => {
  const { searchParams } = req.nextUrl

  // -----------------------------------------------------------------------
  // Parse query parameters
  // -----------------------------------------------------------------------
  const { page, limit, skip } = resolvePagination(
    { page: searchParams.get("page"), limit: searchParams.get("limit") },
    20,
  )

  const moduleFilter = searchParams.get("module") ?? undefined
  const actorIdFilter = searchParams.get("actorId") ?? undefined
  const actionFilter = searchParams.get("action") ?? undefined
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  // -----------------------------------------------------------------------
  // Build Prisma where clause
  // -----------------------------------------------------------------------
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
      // Include the entire `dateTo` day by setting time to end of day.
      const to = new Date(dateTo)
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999)
        ;(where.createdAt as Prisma.DateTimeFilter).lte = to
      }
    }
  }

  // -----------------------------------------------------------------------
  // Run count + page query in parallel
  // -----------------------------------------------------------------------
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
