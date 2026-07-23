import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { syncSeoProperty } from "@/features/seo/server/seo.service"
import { getSeoOverview } from "@/features/seo/server/seo.queries"
import { runVitalsCheck, runTrafficSync } from "@/features/seo/server/seo.vitals.service"
import { buildScorecard } from "@/features/seo/server/seo.scorecard"
import { isGscConfigured } from "@/lib/gsc"

// Weekly Search Console pull for every active SEO property, then the monitoring
// rules from the SEO plan. Critical/warning alerts notify the project owner (who
// already gets push via lib/notifications).
// Run weekly, e.g. Monday 06:00. Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!(await isGscConfigured())) {
      return NextResponse.json({ error: "Search Console is not configured" }, { status: 503 })
    }

    const properties = await db.seoProperty.findMany({
      where: { isActive: true },
      select: {
        id: true,
        domain: true,
        label: true,
        projectId: true,
        project: { select: { name: true, ownerId: true } },
      },
      orderBy: [{ projectId: "asc" }, { isPrimary: "desc" }],
    })

    let synced = 0
    let failed = 0
    let notified = 0
    const results: { domain: string; ok: boolean; error?: string; alerts?: number }[] = []

    // Sequential on purpose: Google rate-limits per project, and a weekly job has
    // no reason to be fast.
    for (const p of properties) {
      // A project can track many sites (KYG has 13 subdomains), so every
      // notification names the site as well as the project.
      const site = `${p.project.name} · ${p.label}`
      const res = await syncSeoProperty(p.id)
      if (!res.ok) {
        failed++
        results.push({ domain: p.domain, ok: false, error: res.error })
        // A broken property is worth telling someone about - it means the report
        // is silently going stale.
        if (p.project.ownerId) {
          await createNotification({
            employeeId: p.project.ownerId,
            title: `SEO sync failed - ${site}`,
            message: res.error ?? "Search Console sync failed.",
            type: "error",
            link: `/projects/${p.projectId}?tab=seo`,
          })
          notified++
        }
        continue
      }
      synced++

      // Core Web Vitals + GA4 + scorecard for the same site, in that order -
      // the scorecard reads whatever the two collectors just stored. Each is
      // independently failure-tolerant: a site with no GA4 id still scores on
      // Search Console alone, with `coverage` reporting the shortfall.
      try {
        await runVitalsCheck(p.id)
      } catch (e) {
        console.error("[SEO_WEEKLY] vitals", p.domain, e)
      }
      try {
        await runTrafficSync(p.id)
      } catch (e) {
        console.error("[SEO_WEEKLY] ga4", p.domain, e)
      }
      try {
        await buildScorecard(p.id)
      } catch (e) {
        console.error("[SEO_WEEKLY] scorecard", p.domain, e)
      }

      const overview = await getSeoOverview(p.id)
      const actionable = (overview?.alerts ?? []).filter((a) => a.level !== "info")
      results.push({ domain: p.domain, ok: true, alerts: actionable.length })

      if (actionable.length && p.project.ownerId) {
        const worst = actionable.find((a) => a.level === "critical") ?? actionable[0]!
        await createNotification({
          employeeId: p.project.ownerId,
          title: `SEO alert - ${site}`,
          message:
            actionable.length > 1
              ? `${worst.title}. ${actionable.length - 1} more issue${actionable.length > 2 ? "s" : ""} to review.`
              : `${worst.title}. ${worst.detail}`,
          type: worst.level === "critical" ? "error" : "warning",
          link: `/projects/${p.projectId}?tab=seo`,
        })
        notified++
      }
    }

    return NextResponse.json({
      success: true,
      properties: properties.length,
      synced,
      failed,
      notified,
      results,
    })
  } catch (error) {
    console.error("[SEO_WEEKLY_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
