import "server-only"

import { db } from "@/server/db"
import { runWithTenant } from "@/server/tenant-context"
import type { Principal } from "./principal"

// Tool-call usage log: what was called and whether it worked - never arguments or results
// (personal data). Skipped for the hidden admin_ account; purged after 90 days.

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export function logToolCall(
  principal: Principal,
  entry: { tool: string; target?: string; ok: boolean; status?: number; durationMs: number },
): void {
  if (principal.invisible) return
  void runWithTenant({ tenantId: principal.tenantId, slug: principal.tenantSlug }, async () => {
    await db.mcpToolCall.create({
      data: {
        tenantId: principal.tenantId,
        grantId: principal.grantId,
        employeeId: principal.session.user.id,
        tool: entry.tool,
        target: entry.target?.slice(0, 300) ?? null,
        ok: entry.ok,
        status: entry.status ?? null,
        durationMs: entry.durationMs,
      },
    })
    if (Math.random() < 0.01) {
      await db.mcpToolCall.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
      })
    }
  }).catch((err) => console.warn("[mcp] usage log failed", err))
}
