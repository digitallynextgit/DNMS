// =============================================================================
// Client-portal auth/access guards
// =============================================================================
// The single chokepoint for "may this client see this?". Every portal read goes
// through `requireClientProject` / `requireClientModule` - none of them take a
// projectId on trust from the request.
//
// Access is resolved from the DATABASE on every request, never from the JWT.
// That costs one indexed lookup and buys immediate revocation: pulling a grant
// or suspending an account takes effect on the client's very next click instead
// of whenever their token happens to expire.
// =============================================================================

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
  /**
   * What portal URLs are built from: the slug when the project has one, else the
   * id. Readable links, and it is what `requireClientProject` accepts back.
   */
  projectRef: string
  modules: ClientModuleKey[]
}

/** A signed-in, ACTIVE client account. Staff sessions are rejected. */
export async function requireClientSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new ActionError("Unauthorized", 401)
  if (session.user.kind !== "client") {
    throw new ActionError("Forbidden: client portal accounts only", 403)
  }

  // Sessions are stateless JWTs, so an account disabled mid-session still holds
  // a valid cookie - re-check on every call rather than trusting the token.
  const account = await db.clientUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account?.isActive) throw new ActionError("Your access has been disabled", 403)

  return session
}

/** Every project this client may see, with the modules their package unlocks. */
export async function listClientGrants(clientUserId: string): Promise<ClientProjectGrant[]> {
  const rows = await db.clientProjectAccess.findMany({
    where: {
      clientUserId,
      status: "ACTIVE",
      // An archived project disappears from the portal without anyone having to
      // remember to revoke the grant.
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
 * Resolve ONE project for this client from a SLUG OR ID.
 *
 * Portal URLs carry the slug, so this accepts either form and hands back the
 * grant - whose `projectId` is the real id. Callers must query on that, never on
 * the ref they were given, or a slug ends up in a `where: { projectId }` and
 * silently matches nothing.
 *
 * Throws 404 (not 403) when there is no grant: a client should not be able to
 * probe which projects exist by comparing error codes.
 */
export async function requireClientProject(
  clientUserId: string,
  projectRef: string,
): Promise<ClientProjectGrant> {
  const row = await db.clientProjectAccess.findFirst({
    where: {
      clientUserId,
      status: "ACTIVE",
      // The ref is matched against BOTH forms. A slug simply fails the `id`
      // arm (ids are uuids) rather than erroring, and vice versa.
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

/**
 * The guard every portal data read starts with: the caller must be an active
 * client, hold this project, AND hold this module on it.
 *
 * Returns the grant so the caller can query on `grant.projectId` - the resolved
 * id - instead of the slug it was handed.
 */
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
