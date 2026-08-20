import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  findConflictingProperty,
  getSeoProperties,
  serializeConfig,
} from "@/features/seo/server/seo.queries"
import { seoPropertySchema } from "@/features/seo/server/seo.schemas"
import { gscServiceAccountEmail, isGscConfigured } from "@/lib/gsc"
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
  moneyPages: true,
  competitors: true,
  targetClicks: true,
  targetPosition: true,
  isActive: true,
  lastSyncedAt: true,
  lastSyncError: true,
} as const

// GET - every site tracked under this project, plus whether Search Console
// credentials exist at all so the tab can explain what's missing.
//
// withProjectAccess, NOT withAuth: the project arrives in the URL as a slug, and
// only the project guards resolve that to the real id before the handler runs.
// With withAuth this queried seo_properties for a row whose projectId was the
// literal slug, always found nothing, and reported "No sites tracked yet" while
// POST - which does resolve - had written the row under the real id.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const [properties, gscConfigured, serviceAccount] = await Promise.all([
      getSeoProperties(ctx.params.id),
      isGscConfigured(),
      gscServiceAccountEmail(),
    ])
    return NextResponse.json({ data: { properties, gscConfigured, serviceAccount } })
  },
)

// POST - track another site under this project (e.g. one of KYG's subdomains).
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const projectId = ctx.params.id
    const parsed = seoPropertySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 422 },
      )
    }
    const b = parsed.data

    const clash = await findConflictingProperty(projectId, b)
    if (clash) {
      return NextResponse.json(
        {
          error:
            `That site is already tracked here as "${clash.label}" (${clash.domain}). ` +
            `Both point at the same Search Console property.`,
        },
        { status: 409 },
      )
    }

    // The first site added becomes the primary unless told otherwise.
    const existing = await db.seoProperty.count({ where: { projectId } })
    const isPrimary = b.isPrimary ?? existing === 0

    const created = await db.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.seoProperty.updateMany({ where: { projectId }, data: { isPrimary: false } })
      }
      return tx.seoProperty.create({
        data: {
          projectId,
          label: b.label,
          isPrimary,
          domain: b.domain,
          siteUrl: b.siteUrl || null,
          gaPropertyId: b.gaPropertyId || null,
          moneyKeywords: b.moneyKeywords ?? [],
          moneyPages: b.moneyPages ?? [],
          competitors: b.competitors ?? [],
          targetClicks: b.targetClicks ?? null,
          targetPosition: b.targetPosition ?? null,
          isActive: b.isActive ?? true,
        },
        select: CONFIG_SELECT,
      })
    })

    return NextResponse.json({ data: serializeConfig(created) }, { status: 201 })
  },
)
