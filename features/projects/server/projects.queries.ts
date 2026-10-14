import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { resolveProjectId, canAccessProject } from "./project-access"
import { SERVICE_OWNER_SELECT } from "./project-service-owners"
import { kickoffProgressFor } from "./kickoff.service"
import { isProjectLead, leadConditions } from "../lib/project-leads"

export interface ListProjectsOptions {
  status?: string
  mine?: boolean
  clientId?: string
  page?: number | string | null
  limit?: number | string | null
}

const PERSON = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

/** Permission-scoped project list, shared by GET /api/projects and the page prefetch. */
export async function listProjects(opts: ListProjectsOptions, session: Session) {
  const { status, mine } = opts
  const { page, limit, skip, take } = resolvePagination({ page: opts.page, limit: opts.limit }, 20)

  // No isArchived filter: archiving was removed, and the old flag must not hide projects.
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (opts.clientId) where.clientId = opts.clientId
  // project:write sees all; everyone else only projects they are AM of or on. `mine` only narrows.
  const canViewAll = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  if (!canViewAll || mine) {
    where.OR = [
      ...leadConditions(session.user.id),
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
        owner: { select: PERSON },
        secondaryAccountManager: { select: PERSON },
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
        serviceOwners: { select: SERVICE_OWNER_SELECT },
        _count: { select: { tasks: true, teams: true, resources: true } },
      },
    }),
    db.project.count({ where }),
  ])

  // Once per person: someone can be on several of the project's teams.
  // Kickoff progress only for people who can manage the project (admins and its Account Managers).
  const canManage = (p: Parameters<typeof isProjectLead>[0]) =>
    canViewAll || isProjectLead(p, session.user.id)
  const kickoff = await kickoffProgressFor(projects.filter(canManage).map((p) => p.id))
  const decorated = projects.map((p) => ({
    kickoff: canManage(p) ? (kickoff[p.id] ?? null) : null,
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
