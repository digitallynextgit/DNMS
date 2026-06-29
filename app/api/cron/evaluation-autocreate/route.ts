import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_SECTION_A_LABEL,
  DEFAULT_SECTION_B_LABEL,
} from "@/features/performance/evaluation"
import { HIDDEN_ROLES } from "@/lib/constants"

// Auto-create the current period's performance evaluations for every active
// employee. Built to run TWICE A MONTH (≈ every 15 days) - schedule it on
// cron-job.org for the 1st and 16th. Idempotent: skips anyone who already has an
// evaluation for the computed period, so re-running is safe.
// Auth: Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const day = now.getDate()
    const monthShort = now.toLocaleString("en-US", { month: "short" })
    const yy = String(now.getFullYear()).slice(-2)
    const periodLabel = `${monthShort} ${day <= 15 ? "1–15" : "16–EOM"} '${yy}`

    const template = await db.evaluationTemplate.findFirst({ where: { isActive: true } })
    const criteria = template?.criteria ?? DEFAULT_EVALUATION_CRITERIA
    const sectionALabel = template?.sectionALabel ?? DEFAULT_SECTION_A_LABEL
    const sectionBLabel = template?.sectionBLabel ?? DEFAULT_SECTION_B_LABEL

    // Active employees, excluding the invisible admin_ account.
    const employees = await db.employee.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        employeeRoles: { none: { role: { name: { in: [...HIDDEN_ROLES] } } } },
      },
      select: { id: true, managerId: true, firstName: true },
    })

    let created = 0
    let skipped = 0
    for (const emp of employees) {
      const existing = await db.evaluation.findFirst({
        where: { employeeId: emp.id, periodLabel },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }

      const ev = await db.evaluation.create({
        data: {
          templateId: template?.id ?? null,
          criteria: criteria as object,
          sectionALabel,
          sectionBLabel,
          employeeId: emp.id,
          managerId: emp.managerId,
          periodLabel,
          status: "PENDING",
        },
      })
      created++

      const link = `/performance/evaluations/${ev.id}`
      await createNotification({
        employeeId: emp.id,
        title: "Performance evaluation to complete",
        message: `Please fill your self-evaluation for ${periodLabel}.`,
        type: "info",
        link,
      })
      if (emp.managerId && emp.managerId !== emp.id) {
        await createNotification({
          employeeId: emp.managerId,
          title: "Performance evaluation to review",
          message: `Please complete the manager review for ${emp.firstName} (${periodLabel}).`,
          type: "info",
          link,
        })
      }
    }

    return NextResponse.json({ ok: true, periodLabel, created, skipped, total: employees.length })
  } catch (error) {
    console.error("[cron/evaluation-autocreate]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
