// Client-portal access guards. Access is read from the DB on every request, never the JWT, so
// revoking a grant or account takes effect on the client's next click.

import "server-only"

import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { ActionError } from "./action-result"
import { resolveModules, type ClientModuleKey } from "@/features/client-portal/modules"
import type { Session } from "next-auth"

export interface ClientProjectGrant {
  /** The REAL project id. Every query must filter on this, never on the ref. */
  projectId: string
  projectName: string
  projectCode: string
  projectSlug: string | null
  /** For portal URLs: the slug when there is one, else the id. */
  projectRef: string
  modules: ClientModuleKey[]
}

export async function requireClientSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new ActionError("Unauthorized", 401)
  if (session.user.kind !== "client") {
    throw new ActionError("Forbidden: client portal accounts only", 403)
  }

  // A disabled account still holds a valid JWT, so re-check every call.
  const account = await db.clientUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account?.isActive) throw new ActionError("Your access has been disabled", 403)

  return session
}

export async function listClientGrants(clientUserId: string): Promise<ClientProjectGrant[]> {
  const rows = await db.clientProjectAccess.findMany({
    where: {
      clientUserId,
      status: "ACTIVE",
      // Archived projects drop out without anyone revoking the grant.
      project: { isArchived: false },
    },
    select: {
      modules: true,
      project: { select: { id: true, name: true, code: true, slug: true } },
    },
    orderBy: { project: { name: "asc" } },
  })

  return rows.map((r) => ({
    projectId: r.project.id,
    projectName: r.project.name,
    projectCode: r.project.code,
    projectSlug: r.project.slug,
    projectRef: r.project.slug ?? r.project.id,
    modules: resolveModules(r.modules),
  }))
}

/**
 * Accepts a slug or id; callers must then query on `grant.projectId`, never the ref.
 * 404 (not 403) when there is no grant, so clients can't probe which projects exist.
 */
export async function requireClientProject(
  clientUserId: string,
  projectRef: string,
): Promise<ClientProjectGrant> {
  const row = await db.clientProjectAccess.findFirst({
    where: {
      clientUserId,
      status: "ACTIVE",
      project: { isArchived: false, OR: [{ id: projectRef }, { slug: projectRef }] },
    },
    select: {
      modules: true,
      project: { select: { id: true, name: true, code: true, slug: true } },
    },
  })
  if (!row) throw new ActionError("Project not found", 404)

  return {
    projectId: row.project.id,
    projectName: row.project.name,
    projectCode: row.project.code,
    projectSlug: row.project.slug,
    projectRef: row.project.slug ?? row.project.id,
    modules: resolveModules(row.modules),
  }
}

/** Every portal read starts here: active client + project grant + module on it. */
export async function requireClientModule(
  projectRef: string,
  module: ClientModuleKey,
): Promise<{ session: Session; grant: ClientProjectGrant }> {
  const session = await requireClientSession()
  const grant = await requireClientProject(session.user.id, projectRef)
  if (!grant.modules.includes(module)) {
    throw new ActionError("This section is not available to you", 403)
  }
  return { session, grant }
}
