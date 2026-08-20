import "server-only"

// =============================================================================
// The two scheduled SEO jobs, as plain functions.
// =============================================================================
// Lifted out of the cron ROUTES so the in-process scheduler and the HTTP route
// run the same code rather than two copies that drift. The routes stay as the
// manual trigger and the external-cron entry point; server/scheduler.ts calls
// these directly.
//
// Both are safe to run more often than their names suggest, which is what makes
// scheduling them in-process viable:
//   - the weekly sync upserts one snapshot per (property, window), so a repeat
//     run rewrites the same row rather than inflating history,
//   - the daily monitor stores each run and only notifies on a CHANGE of state,
//     so an extra run is silent.
// =============================================================================

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

/** SEO plan step 9 - the daily accident check across every active property. */
export async function runSeoDailyJob(): Promise<SeoDailyResult> {
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
        link: `/projects/${p.projectId}?tab=seo`,
      })
      notified++
    } else if (res.recovered) {
      await createNotification({
        employeeId: p.project.ownerId,
        title: `SEO recovered - ${site}`,
        message: "Money pages are back to 200 and indexable.",
        type: "success",
        link: `/projects/${p.projectId}?tab=seo`,
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
      await runTechnicalAudit(p.id)
    } catch (e) {
      console.error("[SEO_WEEKLY] technical", p.domain, e)
    }
    // Scorecard LAST - it reads whatever vitals, GA4 and the audit just stored.
    try {
      await buildScorecard(p.id)
    } catch (e) {
      console.error("[SEO_WEEKLY] scorecard", p.domain, e)
    }

    // 30-day content checks (plan step 7, point 6): now that this week's
    // Search Console data is stored, settle any briefs whose review is due.
    try {
      const review = await runContentReviews(p.id)
      if (review.reviewed > 0 && p.project.ownerId) {
        await createNotification({
          employeeId: p.project.ownerId,
          title: `SEO content results - ${site}`,
          message: `${review.reviewed} page${review.reviewed > 1 ? "s" : ""} hit their 30-day check: ${review.won} improved, ${review.flat} flat, ${review.lost} slipped.`,
          type: review.lost > review.won ? "warning" : "success",
          link: `/projects/${p.projectId}?tab=seo`,
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
        link: `/projects/${p.projectId}?tab=seo`,
      })
      notified++
    }
  }

  return { properties: properties.length, synced, failed, notified, results }
}
