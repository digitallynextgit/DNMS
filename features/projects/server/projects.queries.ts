import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"

export interface ListProjectsOptions {
  status?: string
  mine?: boolean
  page?: number | string | null
  limit?: number | string | null
}

/**
 * Paginated, permission-scoped project list.
 *
 * Extracted from GET /api/projects so the route handler AND the server-side
 * prefetch in app/(dashboard)/projects/page.tsx run the exact same query - the
 * prefetched React Query cache entry must be byte-identical to the API body the
 * client would otherwise have fetched.
 *
 * Returns the route's payload shape verbatim: `{ data, pagination }`.
 */
export async function listProjects(opts: ListProjectsOptions, session: Session) {
  const { status, mine } = opts
  const { page, limit, skip, take } = resolvePagination({ page: opts.page, limit: opts.limit }, 20)

  const where: Record<string, unknown> = { isArchived: false }
  if (status) where.status = status
  // Admins/PMs (project:write) can see all projects; everyone else is always
  // restricted to projects they own or are a team member of (the `mine`
  // filter can further narrow it for admins, but never widens it for others).
  const canViewAll = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  if (!canViewAll || mine) {
    where.OR = [
      { ownerId: session.user.id },
      { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
    ]
  }

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        teams: {
          select: {
            id: true,
            name: true,
            members: {
              select: {
                employee: {
                  select: { id: true, firstName: true, lastName: true, profilePhoto: true },
                },
              },
            },
          },
        },
        _count: { select: { tasks: true, teams: true, resources: true } },
      },
    }),
    db.project.count({ where }),
  ])

  // Flatten members across all teams for the list-card avatar display
  const decorated = projects.map((p) => ({
    ...p,
    members: p.teams.flatMap((t) => t.members),
  }))

  return {
    data: decorated,
    pagination: paginationMeta(total, page, limit),
  }
}
