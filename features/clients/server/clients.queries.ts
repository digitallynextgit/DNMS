import "server-only"

import { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolveModules } from "@/features/client-portal/modules"
import { clientListQuerySchema } from "../schemas/client.schema"
import { resolveClientId } from "./client-access"

// Client summaries (project counts, people, last sign-in) are derived from relations, not
// stored counters, so they can't drift.

const PERSON_SELECT = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

function summarise(
  projects: { status: string }[],
  contacts: { isActive: boolean; lastLoginAt: Date | null }[],
) {
  let lastLoginAt: Date | null = null
  for (const c of contacts) {
    if (c.lastLoginAt && (!lastLoginAt || c.lastLoginAt > lastLoginAt)) lastLoginAt = c.lastLoginAt
  }
  return {
    projects: projects.length,
    activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
    contacts: contacts.length,
    activeContacts: contacts.filter((c) => c.isActive).length,
    lastLoginAt,
  }
}

/** The directory: paginated and searchable, plus whole-book totals that ignore the filters. */
export async function listClients(raw: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const q = clientListQuerySchema.parse(raw)
    const { page, limit, skip, take } = resolvePagination({ page: q.page, limit: q.limit }, 20)

    const where: Prisma.ClientWhereInput = {}
    if (q.status) where.status = q.status
    if (q.ownerId) where.ownerId = q.ownerId
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { code: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
        { website: { contains: q.search, mode: "insensitive" } },
      ]
    }

    const [rows, total, clients, activeClients, projects, contacts] = await Promise.all([
      db.client.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          status: true,
          industry: true,
          website: true,
          email: true,
          phone: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: PERSON_SELECT },
          projects: { select: { status: true } },
          contacts: { select: { isActive: true, lastLoginAt: true } },
        },
      }),
      db.client.count({ where }),
      db.client.count(),
      db.client.count({ where: { status: "ACTIVE" } }),
      db.project.count({ where: { clientId: { not: null } } }),
      db.clientUser.count({ where: { clientId: { not: null } } }),
    ])

    const data = rows.map(({ projects: ps, contacts: cs, ...client }) => ({
      ...client,
      stats: summarise(ps, cs),
    }))
    return ok(
      serialize({
        data,
        pagination: paginationMeta(total, page, limit),
        summary: { clients, activeClients, projects, contacts },
      }),
    )
  })
}

/** One client with its projects, people and their access - one request for every tab. */
export async function getClient(id: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const client = await db.client.findUnique({
      where: { id },
      include: {
        owner: { select: PERSON_SELECT },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        projects: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            logo: true,
            status: true,
            priority: true,
            startDate: true,
            createdAt: true,
            owner: { select: PERSON_SELECT },
            _count: { select: { tasks: true, teams: true } },
          },
        },
        contacts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
            access: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                modules: true,
                status: true,
                createdAt: true,
                project: { select: { id: true, name: true, code: true, slug: true } },
              },
            },
          },
        },
      },
    })
    if (!client) return fail("Client not found", undefined, 404)

    const { projects, contacts, ...rest } = client
    return ok(
      serialize({
        ...rest,
        projects,
        // Only modules this build understands, as on the project's portal-access list.
        contacts: contacts.map((c) => ({
          ...c,
          access: c.access.map((a) => ({ ...a, modules: resolveModules(a.modules) })),
        })),
        stats: summarise(projects, contacts),
      }),
    )
  })
}

/** The client's portal activity across all contacts, newest first. */
export async function listClientActivity(
  id: string,
  raw: { page?: string | null; limit?: string | null },
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { page, limit, skip, take } = resolvePagination(raw, 25)
    const where: Prisma.ClientActivityLogWhereInput = { clientUser: { clientId: id } }
    const [rows, total] = await Promise.all([
      db.clientActivityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          module: true,
          summary: true,
          entityType: true,
          createdAt: true,
          clientUser: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
      }),
      db.clientActivityLog.count({ where }),
    ])
    return ok(serialize({ data: rows, pagination: paginationMeta(total, page, limit) }))
  })
}

/** A client's name for the browser tab; null if missing or not permitted (the page's gate). */
export async function getClientTitle(idOrSlug: string, session: Session): Promise<string | null> {
  if (!hasPermission(session, PERMISSIONS.CLIENT_READ)) return null
  const id = await resolveClientId(idOrSlug)
  if (!id) return null
  const client = await db.client.findUnique({ where: { id }, select: { name: true } })
  return client?.name ?? null
}
