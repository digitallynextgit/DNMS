import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { runDailyMonitor } from "@/features/seo/server/seo.monitor.service"

// The daily accident monitor (SEO plan step 9). Checks every active property's
// money pages for uptime + noindex and robots.txt for a blanket block, and
// notifies the project owner ONLY when the state changes (newly broken, or a new
// problem, or recovered) - so a persistent issue doesn't spam a daily alert.
// Run daily, e.g. 07:00 IST. Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
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

    return NextResponse.json({
      success: true,
      properties: properties.length,
      checked,
      withIssues,
      notified,
      results,
    })
  } catch (error) {
    console.error("[SEO_DAILY_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
