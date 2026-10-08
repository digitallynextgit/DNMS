import "server-only"

import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolve a client slug (or a legacy id) from the URL to a client id, or null. */
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

/** Route guard for /api/clients/[id]/*: checks `permission`, resolves ctx.params.id to a real
 *  client id in this tenant, and 404s otherwise. */
export function withClient(permission: string, handler: ClientHandler) {
  return withAuth(permission, async (req, ctx, session) => {
    const clientId = await resolveClientId(ctx.params.id)
    if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })
    ctx.params.id = clientId
    return handler(req, ctx, session)
  })
}
