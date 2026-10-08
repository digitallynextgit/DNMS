import "server-only"

import { db } from "@/server/db"
import { requirePermission, requireSession } from "@/server/action-guard"
import { fail, ok, runAction, serialize, type ActionResult } from "@/server/action-result"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { verifiedClientName } from "./redirects"

// AI connections on /ai-connections: everyone sees their own; role:write holders see everyone's.
// Tenant-scoped; the hidden admin_ account's connections never show in the company list.

const RECENT_REVOKED_MS = 30 * 24 * 60 * 60 * 1000

export interface ConnectionRow {
  id: string
  app: string
  appId: string
  verifiedAs: string | null
  scope: string[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  revokedReason: string | null
  callsLast30Days: number
  employee: { id: string; firstName: string; lastName: string; employeeNo: string } | null
}

export async function listConnections(
  scope: "mine" | "all",
): Promise<ActionResult<ConnectionRow[]>> {
  return runAction(async () => {
    const session =
      scope === "all" ? await requirePermission(PERMISSIONS.ROLE_WRITE) : await requireSession()

    const grants = await db.oAuthGrant.findMany({
      where: {
        ...(scope === "mine"
          ? { employeeId: session.user.id }
          : { employee: VISIBLE_EMPLOYEE_FILTER }),
        OR: [{ revokedAt: null }, { revokedAt: { gte: new Date(Date.now() - RECENT_REVOKED_MS) } }],
      },
      include: {
        client: { select: { name: true, clientId: true, redirectUris: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 300,
    })

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const counts = grants.length
      ? await db.mcpToolCall.groupBy({
          by: ["grantId"],
          where: { grantId: { in: grants.map((g) => g.id) }, createdAt: { gte: since } },
          _count: { _all: true },
        })
      : []
    const countBy = new Map(counts.map((c) => [c.grantId, c._count._all]))

    return ok(
      serialize(
        grants.map((g) => ({
          id: g.id,
          app: g.client.name,
          appId: g.client.clientId,
          verifiedAs:
            g.client.redirectUris.map(verifiedClientName).find((v): v is string => !!v) ?? null,
          scope: g.scope.split(" ").filter(Boolean),
          createdAt: g.createdAt,
          lastUsedAt: g.lastUsedAt,
          revokedAt: g.revokedAt,
          revokedReason: g.revokedReason,
          callsLast30Days: countBy.get(g.id) ?? 0,
          employee: scope === "all" ? g.employee : null,
        })),
      ) as ConnectionRow[],
    )
  })
}

export async function revokeConnection(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requireSession()
    const grant = await db.oAuthGrant.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    })
    if (!grant) return fail("Connection not found", undefined, 404)

    const own = grant.employeeId === session.user.id
    if (!own) await requirePermission(PERMISSIONS.ROLE_WRITE)
    if (grant.revokedAt) return ok({ id })

    await db.oAuthGrant.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revokedReason: own ? "disconnected_by_user" : "disconnected_by_admin",
      },
    })
    await createAuditLog(session, {
      action: "ai_connector:disconnect",
      module: "ai_connector",
      entityType: "OAuthGrant",
      entityId: id,
      changes: { app: grant.client.name, employeeId: grant.employeeId },
    }).catch(() => {})
    return ok({ id })
  })
}
