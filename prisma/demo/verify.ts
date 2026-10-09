/**
 * READ-ONLY checks for the demo workspace:
 *   pnpm exec tsx --conditions=react-server prisma/demo/verify.ts [before.json]
 * 1. every persona and the portal contact can sign in (same checks as server/auth.ts)
 * 2. no row in the real company points at a demo person
 * 3. the states the Help guides rely on are present
 * 4. with before.json (from counts.ts --json): the real company's counts then vs now
 */
import "dotenv/config"
import { readFileSync } from "node:fs"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { findLoginUser, loadActiveMemberships } from "@/server/identity"
import {
  FOUNDING_TENANT_ID,
  FOUNDING_TENANT_SLUG,
  runUnscoped,
  runWithTenant,
} from "@/server/tenant-context"
import { DEMO_EMAIL_DOMAIN, DEMO_TENANT_SLUG } from "@/lib/demo"
import { DEMO_PERSONAS, demoPerson } from "@/features/help/demo/dataset"
import { tenantCounts } from "./counts"

let failures = 0
const check = (ok: boolean, what: string) => {
  if (!ok) failures++
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`)
}

async function main() {
  const password = process.env.DEMO_PASSWORD
  if (!password) throw new Error("DEMO_PASSWORD is not set")
  const tenant = await runUnscoped("verify: find the demo tenant", () =>
    db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } }),
  )
  if (!tenant) throw new Error("No demo tenant")
  console.log(
    `Demo tenant ${tenant.slug} ${tenant.id} status=${tenant.status} plan=${tenant.plan} trialEndsAt=${tenant.trialEndsAt}`,
  )

  console.log("\nLogins")
  const logins = [
    ...Object.entries(DEMO_PERSONAS).map(([persona, key]) => ({
      label: persona,
      email: demoPerson(key).email,
      kind: "STAFF",
    })),
    { label: "client", email: `nandini.rao@${DEMO_EMAIL_DOMAIN}`, kind: "CLIENT" },
  ]
  for (const l of logins) {
    const user = await runUnscoped("verify: login lookup", () => findLoginUser(l.email))
    const pwOk =
      !!user?.passwordHash && user.isActive && (await bcrypt.compare(password, user.passwordHash))
    const memberships = user ? await loadActiveMemberships(user.id) : []
    const m = memberships.find((x) => x.tenantId === tenant.id && x.kind === l.kind)
    check(
      pwOk && !!m && !user!.mustChangePassword,
      `${l.label.padEnd(8)} ${l.email} - password ${pwOk ? "matches" : "WRONG"}, ${m ? `${m.kind} membership in ${m.tenantSlug}` : "NO membership"}`,
    )
  }

  await runWithTenant({ tenantId: tenant.id, slug: tenant.slug }, async () => {
    const emp = async (key: string) =>
      (await db.employee.findFirst({
        where: { email: demoPerson(key).email },
        select: { id: true },
      }))!.id
    const priya = await emp("priya")
    const rohan = await emp("rohan")
    const now = new Date()
    const ist = new Date(now.getTime() + 330 * 60_000)
    const today = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
    const prevStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    const prevEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))

    console.log("\nGuide states")
    const rohanReports = await db.employee.findMany({
      where: { managerId: rohan },
      select: { id: true },
    })
    const reportIds = rohanReports.map((r) => r.id)
    check(
      (await db.leaveRequest.count({
        where: {
          employeeId: priya,
          status: "PENDING",
          leaveType: { code: "CL" },
          startDate: { gt: today },
        },
      })) === 1,
      "Priya: one PENDING Casual Leave coming up",
    )
    const teamPending = await db.leaveRequest.count({
      where: { employeeId: { in: reportIds }, status: "PENDING" },
    })
    check(teamPending >= 3, `Rohan: ${teamPending} PENDING leave requests from his team`)
    check(
      (await db.leaveBalance.count({ where: { employeeId: priya, leaveType: { code: "CL" } } })) ===
        1,
      "Priya: Casual Leave balance",
    )
    check(
      (await db.wfhRequest.count({
        where: { employeeId: priya, status: "PENDING", date: { gt: today } },
      })) === 1,
      "Priya: PENDING WFH request (for Rohan)",
    )
    const prevLogs = await db.attendanceLog.findMany({
      where: { employeeId: priya, date: { gte: prevStart, lte: prevEnd } },
      select: { status: true, checkOut: true },
    })
    check(
      prevLogs.some((l) => l.status === "PRESENT" && l.checkOut),
      "Priya, previous month: a present day",
    )
    check(
      prevLogs.some((l) => l.status === "HALF_DAY"),
      "Priya, previous month: a half day",
    )
    check(
      prevLogs.some((l) => !l.checkOut),
      "Priya, previous month: a missing punch-out",
    )
    check(
      (await db.leaveRequest.count({
        where: {
          employeeId: priya,
          status: "APPROVED",
          startDate: { gte: prevStart, lte: prevEnd },
        },
      })) >= 1,
      "Priya, previous month: an approved leave",
    )
    check(
      (await db.wfhRequest.count({
        where: { employeeId: priya, status: "APPROVED", date: { gte: prevStart, lte: prevEnd } },
      })) >= 1,
      "Priya, previous month: an approved WFH day",
    )
    check(
      (await db.wfhRequest.count({ where: { employeeId: priya, status: "REJECTED" } })) >= 1,
      "Priya: a rejected WFH request",
    )
    check(
      (await db.payrollRecord.count({ where: { employeeId: priya, status: "PAID" } })) >= 2,
      "Priya: 2+ PAID payslips",
    )
    check(
      (await db.payrollRecord.count({
        where: { month: today.getUTCMonth() + 1, year: today.getUTCFullYear(), status: "DRAFT" },
      })) > 0,
      "Payroll: current month in DRAFT",
    )
    const evals = await db.evaluation.findMany({
      where: { employeeId: priya },
      select: { status: true },
    })
    check(
      evals.some((e) => e.status === "PENDING") && evals.some((e) => e.status === "COMPLETED"),
      "Priya: a PENDING and a COMPLETED evaluation",
    )
    const ananya = await emp("ananya")
    check(
      (await db.evaluation.count({
        where: { employeeId: ananya, managerId: rohan, status: "SELF_DONE" },
      })) === 1,
      "Ananya: SELF_DONE evaluation for Rohan",
    )
    const meera = await emp("meera")
    const karthik = await emp("karthik")
    for (const [who, id] of [
      ["Meera", meera],
      ["Karthik", karthik],
      ["Rohan", rohan],
    ] as const) {
      const n = await db.checklistInstanceItem.count({
        where: { assigneeId: id, isDone: false, instance: { status: "IN_PROGRESS" } },
      })
      check(n > 0, `${who}: ${n} item(s) on "Waiting on you"`)
    }
    check(
      (await db.checklistInstanceItem.count({
        where: { assigneeId: rohan, isDone: false, text: "Manager / Reporting Head" },
      })) === 1,
      'Rohan: Pooja\'s "Manager / Reporting Head" clearance open',
    )
    check(
      (await db.checklistInstanceItem.count({
        where: { assigneeId: karthik, isDone: false, text: "IT / Admin" },
      })) === 1,
      'Karthik: "IT / Admin" clearance unsigned',
    )
    check(
      (await db.resignation.count({ where: { status: "PENDING" } })) === 1,
      "A PENDING resignation (Arjun)",
    )
    const floating = await db.floatingHolidaySelection.findMany({
      where: { employeeId: priya },
      select: { status: true },
    })
    check(
      floating.length >= 1 && floating.length < 3,
      `Priya: ${floating.length} floating pick(s), fewer than 3`,
    )
    check(
      (await db.floatingHolidaySelection.count({
        where: { employeeId: { in: reportIds }, status: "PENDING" },
      })) >= 1,
      "Rohan: a PENDING floating holiday request from a report",
    )
    const priyaTasks = await db.projectTask.findMany({
      where: {
        assigneeId: priya,
        dueDate: {
          gte: new Date(today.getTime() - 3 * 86_400_000),
          lte: new Date(today.getTime() + 4 * 86_400_000),
        },
      },
      select: { status: true, dueDate: true, projectId: true, requirementId: true },
    })
    check(
      priyaTasks.some((t) => t.dueDate?.getTime() === today.getTime()),
      "Priya: tasks due today",
    )
    check(
      priyaTasks.some((t) => t.status === "TODO" && t.dueDate! < today),
      "Priya: an overdue task",
    )
    check(
      priyaTasks.some((t) => t.requirementId),
      "Priya: a task blocked by a requirement",
    )
    check(
      priyaTasks.some((t) => !t.projectId),
      "Priya: an adhoc task",
    )
    check(
      new Set(priyaTasks.map((t) => t.projectId).filter(Boolean)).size >= 3,
      "Priya: tasks across 3+ projects",
    )
    const dow = today.getUTCDay()
    const monday = new Date(today.getTime() + (dow === 0 ? -6 : 1 - dow) * 86_400_000)
    const friday = new Date(monday.getTime() + 4 * 86_400_000)
    const sunriseWeek = await db.projectTask.findMany({
      where: {
        project: { slug: "sunmeadow-organics-launch" },
        dueDate: { gte: monday, lte: friday },
      },
      select: {
        assigneeId: true,
        status: true,
        _count: { select: { checklistItems: true, comments: true, statusPeriods: true } },
      },
    })
    const people = new Set(sunriseWeek.map((t) => t.assigneeId)).size
    check(
      sunriseWeek.length >= 10 && people >= 3,
      `Sunmeadow this week: ${sunriseWeek.length} tasks across ${people} people (${[...new Set(sunriseWeek.map((t) => t.status))].join(", ")})`,
    )
    check(
      sunriseWeek.every(
        (t) =>
          t._count.checklistItems >= 2 && t._count.comments === 2 && t._count.statusPeriods >= 1,
      ),
      "Sunmeadow this week: every task has a checklist, 2 comments and status history",
    )
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const newThisMonth = await db.employee.count({ where: { createdAt: { gte: monthStart } } })
    check(
      newThisMonth <= 2,
      `Analytics: ${newThisMonth} employee record(s) created this month (createdAt = joining date)`,
    )
    const statuses = await db.employee.groupBy({ by: ["status"], _count: true })
    check(
      statuses.length >= 2,
      `Employee statuses: ${statuses.map((s) => `${s.status} ${s._count}`).join(", ")}`,
    )
    // The Teams tab opens on AM (just the Account Manager), then WEB with a manager and a member.
    const sunTeams = await db.projectTeam.findMany({
      where: { project: { slug: "sunmeadow-organics-launch" } },
      select: { name: true, managerId: true, members: { select: { employeeId: true } } },
    })
    const am = sunTeams.find((t) => t.name === "AM")
    const web = sunTeams.find((t) => t.name === "WEB")
    check(
      am?.managerId === rohan && am.members.length === 1,
      `Sunmeadow AM team: Rohan alone (${am?.members.length ?? 0} member(s))`,
    )
    check(
      !!web?.managerId && web.members.length >= 2,
      `Sunmeadow WEB team: manager + ${(web?.members.length ?? 1) - 1} member(s)`,
    )
    // "Add people" offers everyone not on that team yet, whatever other teams they are on.
    const assignable = await db.employee.count({
      where: {
        isActive: true,
        status: "ACTIVE",
        id: { notIn: am?.members.map((m) => m.employeeId) ?? [] },
      },
    })
    check(assignable >= 5, `"Add people" to Sunmeadow AM: ${assignable} eligible employees`)
    const seats = new Map<string, number>()
    for (const t of sunTeams) {
      for (const m of t.members) seats.set(m.employeeId, (seats.get(m.employeeId) ?? 0) + 1)
    }
    check(
      [...seats.values()].filter((n) => n > 1).length >= 2,
      "Sunmeadow: people on more than one team",
    )
    const priyaPay = await db.payrollRecord.findMany({
      where: { employeeId: priya, status: "PAID" },
      select: { lopDays: true, totalDeductions: true },
    })
    check(
      priyaPay.some((p) => p.lopDays >= 1),
      "Priya: a PAID month with a loss-of-pay day",
    )
    check(
      (await db.payrollRecord.count({ where: { totalDeductions: { gt: 0 } } })) >= 3,
      "Payroll: rows with non-zero deductions",
    )
    check(
      (await db.careerApplication.count({ where: { isRepeat: true } })) >= 1,
      'Applications: a "Re-applied" one',
    )
    check(
      (await db.careerApplication.count({ where: { roleResolved: false } })) >= 1,
      'Applications: a "Role closed" one',
    )
    check(
      (await db.wfhRequest.count({
        where: { employeeId: { in: reportIds }, status: "PENDING", isEmergency: true },
      })) >= 1,
      "Rohan's team: an EMERGENCY pending WFH request",
    )
    const msgs = [
      ...(await db.projectMessage.findMany({ select: { createdAt: true, updatedAt: true } })),
      ...(await db.projectMessageReply.findMany({ select: { createdAt: true, updatedAt: true } })),
    ]
    check(
      msgs.every((m) => m.updatedAt.getTime() === m.createdAt.getTime()),
      `Project chats: none of ${msgs.length} messages shows "edited"`,
    )
    const metaStatuses = [
      ...new Set(
        (await db.metaCampaign.findMany({ select: { status: true } })).map((c) => c.status),
      ),
    ]
    check(
      metaStatuses.every((s) => ["active", "paused", "completed"].includes(s)),
      `Meta campaign statuses: ${metaStatuses.join(", ")}`,
    )
    const integration = await db.projectIntegration.findFirst({ select: { metaAdAccountId: true } })
    check(
      !integration?.metaAdAccountId?.startsWith("act_"),
      "Meta ad account id stored without the act_ prefix",
    )
    const grants = await db.oAuthGrant.count({ where: { revokedAt: null } })
    check(grants >= 3, `AI connections: ${grants} active`)

    const slugs = await db.project.findMany({ select: { slug: true } })
    for (const s of ["sunmeadow-organics-launch", "urbannest-website-seo"]) {
      check(
        slugs.some((x) => x.slug === s),
        `project slug ${s}`,
      )
    }
    check(
      (await db.client.count({ where: { slug: "sunmeadow-foods-pvt-ltd" } })) === 1,
      "client slug sunmeadow-foods-pvt-ltd",
    )
    check(
      (await db.uptimeMonitor.count({ where: { isActive: true } })) === 0,
      "no ACTIVE uptime monitor (sweep skips all)",
    )
    check(
      (await db.seoProperty.count({ where: { isActive: true } })) === 0,
      "no ACTIVE SEO site (SEO job skips the tenant)",
    )
    check(
      (await db.hikvisionDevice.count({ where: { isActive: true } })) === 0,
      "no ACTIVE attendance device (sync skips them)",
    )
    check(
      (await db.projectCampaign.count({ where: { status: { in: ["QUEUED", "SENDING"] } } })) === 0,
      "no QUEUED/SENDING campaign",
    )
    const emails = [
      ...(await db.employee.findMany({ select: { email: true } })).map((e) => e.email),
      ...(await db.clientUser.findMany({ select: { email: true } })).map((e) => e.email),
      ...(await db.projectRecipient.findMany({ select: { email: true } })).map((e) => e.email),
      ...(await db.careerApplication.findMany({ select: { email: true } })).map((e) => e.email),
      ...(await db.applicant.findMany({ select: { email: true } })).map((e) => e.email),
    ]
    check(
      emails.every((e) => e.endsWith(`@${DEMO_EMAIL_DOMAIN}`)),
      `all ${emails.length} stored person emails are on ${DEMO_EMAIL_DOMAIN}`,
    )
  })

  console.log("\nCross-tenant leak check (real company)")
  const demoIds = await runUnscoped("verify: demo ids", async () =>
    (await db.employee.findMany({ where: { tenantId: tenant.id }, select: { id: true } })).map(
      (e) => e.id,
    ),
  )
  await runWithTenant({ tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }, async () => {
    const leaks = {
      employees: await db.employee.count({
        where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
      }),
      attendanceLogs: await db.attendanceLog.count({ where: { employeeId: { in: demoIds } } }),
      leaveRequests: await db.leaveRequest.count({ where: { employeeId: { in: demoIds } } }),
      tasks: await db.projectTask.count({
        where: { OR: [{ assigneeId: { in: demoIds } }, { creatorId: { in: demoIds } }] },
      }),
      notifications: await db.notification.count({ where: { employeeId: { in: demoIds } } }),
      checklistItems: await db.checklistInstanceItem.count({
        where: { assigneeId: { in: demoIds } },
      }),
      teamMembers: await db.projectTeamMember.count({ where: { employeeId: { in: demoIds } } }),
      chatParticipants: await db.conversationParticipant.count({
        where: { employeeId: { in: demoIds } },
      }),
      auditLogs: await db.auditLog.count({ where: { actorId: { in: demoIds } } }),
      memberships: await db.membership.count({ where: { employeeId: { in: demoIds } } }),
    }
    for (const [k, n] of Object.entries(leaks)) check(n === 0, `${k}: ${n}`)
  })

  const beforePath = process.argv.slice(2).find((a) => a.endsWith(".json"))
  if (beforePath) {
    console.log(`\nReal company (${FOUNDING_TENANT_SLUG}) row counts: before -> now`)
    const before = JSON.parse(readFileSync(beforePath, "utf8")) as Record<string, number>
    const after = (await tenantCounts(FOUNDING_TENANT_SLUG))!
    let changed = 0
    for (const k of Object.keys({ ...before, ...after }).sort()) {
      if ((before[k] ?? 0) !== (after[k] ?? 0)) {
        changed++
        console.log(`  ${k.padEnd(32)} ${before[k] ?? 0} -> ${after[k] ?? 0}`)
      }
    }
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    console.log(
      `  ${changed} of ${Object.keys(after).length} tables differ; total ${sum(before)} -> ${sum(after)}`,
    )
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed")
  if (failures) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
