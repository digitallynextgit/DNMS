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
  clientId?: string
  page?: number | string | null
  limit?: number | string | null
}

/** Permission-scoped project list, shared by GET /api/projects and the page prefetch. */
export async function listProjects(opts: ListProjectsOptions, session: Session) {
  const { status, mine } = opts
  const { page, limit, skip, take } = resolvePagination({ page: opts.page, limit: opts.limit }, 20)

  // No isArchived filter: archiving was removed, and the old flag must not hide projects.
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (opts.clientId) where.clientId = opts.clientId
  // project:write sees all; everyone else only projects they own or are on. `mine` only narrows.
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

  // Once per person: someone can be on several of the project's teams.
  const decorated = projects.map((p) => ({
    ...p,
    members: [
      ...new Map(p.teams.flatMap((t) => t.members).map((m) => [m.employee.id, m])).values(),
    ],
  }))

  return {
    data: decorated,
    pagination: paginationMeta(total, page, limit),
  }
}

/** Project name for the browser tab, or null if missing or not accessible to this reader. */
export async function getProjectTitle(idOrSlug: string, session: Session): Promise<string | null> {
  const id = await resolveProjectId(idOrSlug)
  if (!id || !(await canAccessProject(session, id))) return null
  const project = await db.project.findUnique({ where: { id }, select: { name: true } })
  return project?.name ?? null
}
