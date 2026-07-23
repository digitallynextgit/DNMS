import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { serializeConfig } from "@/features/seo/server/seo.queries"
import { seoPropertySchema } from "@/features/seo/server/seo.schemas"
import type { Session } from "next-auth"

const CONFIG_SELECT = {
  id: true,
  projectId: true,
  label: true,
  isPrimary: true,
  domain: true,
  siteUrl: true,
  gaPropertyId: true,
  moneyKeywords: true,
  competitors: true,
  targetClicks: true,
  targetPosition: true,
  isActive: true,
  lastSyncedAt: true,
  lastSyncError: true,
} as const

/** A property id from the URL is only valid if it really belongs to this
 *  project - otherwise one project's manager could edit another's site. */
async function assertOwned(projectId: string, propertyId: string): Promise<boolean> {
  const p = await db.seoProperty.findFirst({
    where: { id: propertyId, projectId },
    select: { id: true },
  })
  return !!p
}

// PUT - update one tracked site.
export const PUT = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, propertyId } = ctx.params
    if (!(await assertOwned(projectId!, propertyId!))) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    const parsed = seoPropertySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 422 },
      )
    }
    const b = parsed.data

    const clash = await db.seoProperty.findFirst({
      where: { projectId, domain: b.domain, NOT: { id: propertyId } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json(
        { error: `${b.domain} is already tracked on this project` },
        { status: 409 },
      )
    }

    const updated = await db.$transaction(async (tx) => {
      if (b.isPrimary) {
        await tx.seoProperty.updateMany({ where: { projectId }, data: { isPrimary: false } })
      }
      return tx.seoProperty.update({
        where: { id: propertyId },
        data: {
          label: b.label,
          domain: b.domain,
          siteUrl: b.siteUrl || null,
          gaPropertyId: b.gaPropertyId || null,
          ...(b.moneyKeywords ? { moneyKeywords: b.moneyKeywords } : {}),
          ...(b.competitors ? { competitors: b.competitors } : {}),
          targetClicks: b.targetClicks ?? null,
          targetPosition: b.targetPosition ?? null,
          ...(b.isActive === undefined ? {} : { isActive: b.isActive }),
          ...(b.isPrimary === undefined ? {} : { isPrimary: b.isPrimary }),
        },
        select: CONFIG_SELECT,
      })
    })

    return NextResponse.json({ data: serializeConfig(updated) })
  },
)

// DELETE - stop tracking a site. Snapshots cascade away with it.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, propertyId } = ctx.params
    if (!(await assertOwned(projectId!, propertyId!))) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }
    await db.seoProperty.delete({ where: { id: propertyId } })
    return NextResponse.json({ data: { deleted: true } })
  },
)
