import "server-only"

// The scheduled SEO jobs, shared by the in-process scheduler and the cron routes. Both are safe
// to run extra times: snapshots upsert per window and the monitor only alerts on a change.

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { runDailyMonitor } from "@/features/seo/server/seo.monitor.service"
import { syncSeoProperty } from "@/features/seo/server/seo.service"
import { getSeoOverview } from "@/features/seo/server/seo.queries"
import { runVitalsCheck, runTrafficSync } from "@/features/seo/server/seo.vitals.service"
import { buildScorecard } from "@/features/seo/server/seo.scorecard"
import { runTechnicalAudit } from "@/features/seo/server/seo.technical.service"
import { runContentReviews } from "@/features/seo/server/seo.content.service"
import { isGscConfigured } from "@/lib/gsc"
import { projectHref } from "@/features/projects/lib/project-href"

export interface SeoDailyResult {
  properties: number
  checked: number
  withIssues: number
  notified: number
  results: { domain: string; status: string; issues: number }[]
}

export interface SeoWeeklyResult {
  properties: number
  synced: number
  failed: number
  notified: number
  results: { domain: string; ok: boolean; error?: string; alerts?: number }[]
  skipped?: string
}

/** The daily accident check across every active property. */
export async function runSeoDailyJob(): Promise<SeoDailyResult> {
  const properties = await db.seoProperty.findMany({
    where: { isActive: true },
    select: {
      id: true,
      domain: true,
      label: true,
      projectId: true,
      // slug, so alerts link to /projects/<slug>?tab=seo.
      project: { select: { name: true, ownerId: true, slug: true } },
    },
    orderBy: [{ projectId: "asc" }, { isPrimary: "desc" }],
  })

  let checked = 0
  let withIssues = 0
  let notified = 0
  const results: { domain: string; status: string; issues: number }[] = []

  for (const p of properties) {
    const site = `${p.project.name} · ${p.label}`
    const res = await runDailyMonitor(p.id)
    if (!res.ok) continue
    checked++
    if (res.status === "ISSUES") withIssues++
    results.push({ domain: p.domain, status: res.status, issues: res.issues.length })

    if (!p.project.ownerId) continue

    if (res.shouldAlert) {
      const worst = res.issues[0]
      await createNotification({
        employeeId: p.project.ownerId,
        title: `SEO accident - ${site}`,
        message:
          res.issues.length > 1
            ? `${worst?.detail} (+${res.issues.length - 1} more money-page issue${res.issues.length > 2 ? "s" : ""})`
            : (worst?.detail ?? "A money page has a critical problem."),
        type: "error",
        link: projectHref({ id: p.projectId, slug: p.project.slug }, "seo"),
      })
      notified++
    } else if (res.recovered) {
      await createNotification({
        employeeId: p.project.ownerId,
        title: `SEO recovered - ${site}`,
        message: "Money pages are back to 200 and indexable.",
        type: "success",
        link: projectHref({ id: p.projectId, slug: p.project.slug }, "seo"),
      })
      notified++
    }
  }

  return { properties: properties.length, checked, withIssues, notified, results }
}

/** The weekly Search Console pull plus everything that reads from it. */
export async function runSeoWeeklyJob(): Promise<SeoWeeklyResult> {
  if (!(await isGscConfigured())) {
    return { properties: 0, synced: 0, failed: 0, notified: 0, results: [], skipped: "gsc" }
  }

  const properties = await db.seoProperty.findMany({
    where: { isActive: true },
    select: {
      id: true,
      domain: true,
      label: true,
      projectId: true,
      project: { select: { name: true, ownerId: true, slug: true } },
    },
    orderBy: [{ projectId: "asc" }, { isPrimary: "desc" }],
  })

  let synced = 0
  let failed = 0
  let notified = 0
  const results: { domain: string; ok: boolean; error?: string; alerts?: number }[] = []

  // PSI quota is per Cloud project, so once it's gone, stop asking for the rest of the sweep.
  let psiQuotaError: string | null = null

  // Sequential: Google rate-limits per project.
  for (const p of properties) {
    // A project can track many sites, so notifications name the site too.
    const site = `${p.project.name} · ${p.label}`
    const res = await syncSeoProperty(p.id)
    if (!res.ok) {
      failed++
      results.push({ domain: p.domain, ok: false, error: res.error })
      // Tell the owner, or the report silently goes stale.
      if (p.project.ownerId) {
        await createNotification({
          employeeId: p.project.ownerId,
          title: `SEO sync failed - ${site}`,
          message: res.error ?? "Search Console sync failed.",
          type: "error",
          link: projectHref({ id: p.projectId, slug: p.project.slug }, "seo"),
        })
        notified++
      }
      continue
    }
    synced++

    // Vitals, then GA4, then the scorecard (which reads both). Each step tolerates failure.
    if (!psiQuotaError) {
      try {
        const v = await runVitalsCheck(p.id, "MOBILE", { trigger: "scheduled" })
        if (v.quotaError) psiQuotaError = v.quotaError
      } catch (e) {
        console.error("[SEO_WEEKLY] vitals", p.domain, e)
      }
    }
    try {
      await runTrafficSync(p.id)
    } catch (e) {
      console.error("[SEO_WEEKLY] ga4", p.domain, e)
    }
    try {
      await runTechnicalAudit(p.id)
    } catch (e) {
      console.error("[SEO_WEEKLY] technical", p.domain, e)
    }
    try {
      await buildScorecard(p.id)
    } catch (e) {
      console.error("[SEO_WEEKLY] scorecard", p.domain, e)
    }

    // 30-day content checks, now that this week's Search Console data is stored.
    try {
      const review = await runContentReviews(p.id)
      if (review.reviewed > 0 && p.project.ownerId) {
        await createNotification({
          employeeId: p.project.ownerId,
          title: `SEO content results - ${site}`,
          message: `${review.reviewed} page${review.reviewed > 1 ? "s" : ""} hit their 30-day check: ${review.won} improved, ${review.flat} flat, ${review.lost} slipped.`,
          type: review.lost > review.won ? "warning" : "success",
          link: projectHref({ id: p.projectId, slug: p.project.slug }, "seo"),
        })
        notified++
      }
    } catch (e) {
      console.error("[SEO_WEEKLY] content-review", p.domain, e)
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
        link: projectHref({ id: p.projectId, slug: p.project.slug }, "seo"),
      })
      notified++
    }
  }

  // Alert once, not per site, so a scorecard on stale vitals is explained.
  if (psiQuotaError) {
    console.error("[SEO_WEEKLY] vitals skipped:", psiQuotaError)
    const owner = properties.find((p) => p.project.ownerId)?.project.ownerId
    if (owner) {
      await createNotification({
        employeeId: owner,
        title: "SEO: Core Web Vitals skipped",
        message: psiQuotaError,
        type: "warning",
      })
      notified++
    }
  }

  return { properties: properties.length, synced, failed, notified, results }
}
