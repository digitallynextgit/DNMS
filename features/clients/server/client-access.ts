import "server-only"

import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Turn whatever is in the URL into a real client id, or null.
 *
 * Client URLs are slugs (/projects/clients/acme-studios), but an id must keep
 * working too - it is what a row created before it had a slug links by. Both
 * forms cost one indexed lookup; the tenant guard scopes either.
 */
export async function resolveClientId(idOrSlug: string): Promise<string | null> {
  if (!idOrSlug) return null
  const row = UUID_RE.test(idOrSlug)
    ? await db.client.findUnique({ where: { id: idOrSlug }, select: { id: true } })
    : await db.client.findFirst({ where: { slug: idOrSlug }, select: { id: true } })
  return row?.id ?? null
}

type ClientHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
  session: Session,
) => Promise<Response> | Response

/**
 * Route guard for /api/clients/[id]/*: requires `permission`, resolves the slug
 * or id at ctx.params.id to a real client id, and 404s before the handler runs.
 * Handlers read ctx.params.id and can trust it names a client in this tenant.
 */
export function withClient(permission: string, handler: ClientHandler) {
  return withAuth(permission, async (req, ctx, session) => {
    const clientId = await resolveClientId(ctx.params.id)
    if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })
    ctx.params.id = clientId
    return handler(req, ctx, session)
  })
}
