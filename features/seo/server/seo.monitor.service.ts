import "server-only"

import { db } from "@/server/db"
import { auditPage, checkRobots } from "@/lib/crawl"
import { resolveMoneyPages } from "./seo.vitals.service"

// =============================================================================
// The daily accident monitor (plan step 9, "Daily: uptime + robots/noindex
// accident check"). Unlike the weekly technical audit, this only looks for the
// few things that silently kill a site overnight: a money page that stopped
// returning 200, a money page that went noindex, or robots.txt blanket-blocking
// crawlers. It stores each run so the cron can alert on a CHANGE of state rather
// than repeating the same warning every day.
// =============================================================================

const MAX_PAGES = 6

function hostOf(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
}

export interface MonitorIssue {
  url: string
  level: "critical"
  code: string
  detail: string
}

export interface MonitorResult {
  ok: boolean
  status: "OK" | "ISSUES"
  pagesOk: number
  pagesTotal: number
  issues: MonitorIssue[]
  /** Fire an alert: newly broken, or a new problem appeared since the last run. */
  shouldAlert: boolean
  /** It was broken yesterday and is healthy now - worth a positive note. */
  recovered: boolean
  runId?: string
  error?: string
}

/** A stable signature of the current problem set, so we can tell "same as
 *  yesterday" (stay quiet) from "something new broke" (alert). */
function signature(issues: MonitorIssue[]): string {
  return issues
    .map((i) => `${i.url}|${i.code}`)
    .sort()
    .join(";")
}

export async function runDailyMonitor(propertyId: string): Promise<MonitorResult> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, domain: true },
  })
  if (!property)
    return {
      ok: false,
      status: "OK",
      pagesOk: 0,
      pagesTotal: 0,
      issues: [],
      shouldAlert: false,
      recovered: false,
      error: "Property not found",
    }

  const host = hostOf(property.domain)
  const urls = (await resolveMoneyPages(propertyId)).slice(0, MAX_PAGES)

  const issues: MonitorIssue[] = []
  let pagesOk = 0
  for (const url of urls) {
    const page = await auditPage(url, host)
    const down = page.issues.find((i) => i.code === "BAD_STATUS" || i.code === "UNREACHABLE")
    if (down) {
      issues.push({ url, level: "critical", code: down.code, detail: down.detail })
      continue
    }
    if (page.noindex) {
      issues.push({
        url,
        level: "critical",
        code: "NOINDEX",
        detail: "Money page is set to noindex - it will drop out of search.",
      })
      continue
    }
    pagesOk++
  }

  // robots.txt blanket block deindexes the whole site.
  const robots = await checkRobots(`https://${host}`)
  if (robots.issue?.code === "ROBOTS_BLOCK_ALL") {
    issues.push({
      url: `https://${host}/robots.txt`,
      level: "critical",
      code: "ROBOTS_BLOCK_ALL",
      detail: robots.issue.detail,
    })
  }

  const status: "OK" | "ISSUES" = issues.length > 0 ? "ISSUES" : "OK"

  // Compare with the previous run to alert only on change.
  const prev = await db.seoMonitorRun.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    select: { status: true, issues: true },
  })
  const prevIssues = (prev?.issues as unknown as MonitorIssue[]) ?? []
  const prevSig = new Set(signature(prevIssues).split(";").filter(Boolean))
  const nowSigItems = signature(issues).split(";").filter(Boolean)
  const hasNewProblem = nowSigItems.some((s) => !prevSig.has(s))

  const shouldAlert = status === "ISSUES" && (prev?.status !== "ISSUES" || hasNewProblem)
  const recovered = status === "OK" && prev?.status === "ISSUES"

  const run = await db.seoMonitorRun.create({
    data: {
      propertyId,
      status,
      pagesOk,
      pagesTotal: urls.length,
      issues: issues as unknown as object,
    },
    select: { id: true },
  })

  return {
    ok: true,
    status,
    pagesOk,
    pagesTotal: urls.length,
    issues,
    shouldAlert,
    recovered,
    runId: run.id,
  }
}

export interface MonitorView {
  status: "OK" | "ISSUES"
  pagesOk: number
  pagesTotal: number
  issues: MonitorIssue[]
  checkedAt: string
}

/** The latest monitor run for a site, or null (never run). */
export async function getLatestMonitor(propertyId: string): Promise<MonitorView | null> {
  const run = await db.seoMonitorRun.findFirst({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  })
  if (!run) return null
  return {
    status: run.status as "OK" | "ISSUES",
    pagesOk: run.pagesOk,
    pagesTotal: run.pagesTotal,
    issues: (run.issues as unknown as MonitorIssue[]) ?? [],
    checkedAt: run.createdAt.toISOString(),
  }
}
