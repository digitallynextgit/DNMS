import { withCron } from "@/server/cron-auth"
import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { renderRequirementEmail } from "@/lib/email-layout"
import { REQUIREMENT_TYPE_LABELS } from "@/lib/constants"

// Daily (morning): nudges about requirements due today or overdue.

export const runtime = "nodejs"

/** Today at UTC midnight - `needed_by` is a @db.Date. */
function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export const GET = withCron("requirement-reminders", async () => {
  try {
    const today = todayUtc()
    const since = new Date(Date.now() - 20 * 60 * 60 * 1000)

    const due = await db.projectRequirement.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        neededBy: { not: null, lte: today },
        // Once a day at most, however often the cron is retried.
        OR: [{ remindedAt: null }, { remindedAt: { lt: since } }],
      },
      select: {
        id: true,
        title: true,
        details: true,
        type: true,
        neededBy: true,
        requestedFromId: true,
        raisedById: true,
        requestedFrom: { select: { email: true, firstName: true } },
        raisedBy: { select: { firstName: true, lastName: true } },
        project: { select: { id: true, name: true, slug: true } },
        team: { select: { name: true, managerId: true } },
        _count: { select: { blockedTasks: true } },
      },
    })

    let notified = 0
    for (const r of due) {
      const overdue = !!r.neededBy && r.neededBy < today
      const link = `/projects/${r.project.slug ?? r.project.id}?tab=requirements`
      const blocked =
        r._count.blockedTasks > 0 ? ` ${r._count.blockedTasks} task(s) are blocked.` : ""
      const teamLabel = r.team ? `${r.team.name} team` : "A team"

      // The provider and the blocked team's manager - not the raiser, who already knows.
      const audience = new Set<string>([r.requestedFromId])
      if (r.team?.managerId) audience.add(r.team.managerId)
      audience.delete(r.raisedById)

      for (const employeeId of audience) {
        await createNotification({
          employeeId,
          title: overdue ? "Requirement overdue" : "Requirement needed today",
          message: `${teamLabel} is waiting on "${r.title}" for ${r.project.name}.${blocked}`,
          type: overdue ? "error" : "warning",
          link,
        })
        notified++
      }

      // Email only the provider, and only once it is overdue.
      if (overdue && r.requestedFrom?.email) {
        const mail = renderRequirementEmail({
          recipientFirstName: r.requestedFrom.firstName,
          raisedByName: `${r.raisedBy.firstName} ${r.raisedBy.lastName}`.trim(),
          projectName: r.project.name,
          teamName: r.team?.name ?? null,
          type: REQUIREMENT_TYPE_LABELS[r.type] ?? r.type,
          title: r.title,
          details: r.details,
          neededBy: r.neededBy ? r.neededBy.toISOString().slice(0, 10) : null,
          blockedTaskCount: r._count.blockedTasks,
          overdue: true,
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}`,
        })
        addEmailJob({
          to: r.requestedFrom.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        })
      }

      await db.projectRequirement.update({
        where: { id: r.id },
        data: { remindedAt: new Date() },
      })
    }

    return { requirements: due.length, notified }
  } catch (error) {
    console.error("[CRON_REQUIREMENT_REMINDERS]", error)
    throw error
  }
})
