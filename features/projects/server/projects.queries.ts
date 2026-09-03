import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { resolveProjectId, canAccessProject } from "./project-access"

export interface ListProjectsOptions {
  status?: string
  mine?: boolean
  /** Only projects delivered for this client. */
  clientId?: string
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

  // NOTE: no `isArchived` filter. Archiving was removed from the product, so the
  // column is vestigial and must NOT hide rows - a project flagged by the old
  // feature would otherwise be invisible with no way to bring it back.
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (opts.clientId) where.clientId = opts.clientId
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
        client: { select: { id: true, name: true, slug: true } },
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

/**
 * A project's name, for the browser tab.
 *
 * Feeds `generateMetadata` in app/(dashboard)/projects/[id]/layout.tsx. The
 * route takes a slug or a uuid, so the same resolver the API routes use turns
 * it into an id first. Access is checked the way the page's own data is: a
 * project the reader cannot open should not put its name in their tab either.
 *
 * Null when there is no such project or no access, so the caller can fall back
 * to a generic title rather than 404 a layout that only wanted a label.
 */
export async function getProjectTitle(idOrSlug: string, session: Session): Promise<string | null> {
  const id = await resolveProjectId(idOrSlug)
  if (!id || !(await canAccessProject(session, id))) return null
  const project = await db.project.findUnique({ where: { id }, select: { name: true } })
  return project?.name ?? null
}
