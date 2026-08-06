// =============================================================================
// July 2026 leave register -> LeaveRequest / WfhRequest rows.
//
// Source: the leave list for July 2026. Everything is entered as already
// APPROVED, because it is a record of what happened, not a queue of requests.
//
// Type mapping, and where it is a JUDGEMENT CALL (flagged in the output):
//   "Casual leave"  -> CL
//   "Personal leave"-> PL
//   "WFH"           -> WfhRequest (does not consume a leave balance)
//   "Leave"         -> CL        <- unspecified in the source
//   "Absent"        -> LWP       <- an unapproved absence is unpaid
//
// Re-runnable: it owns every row whose reason is SEED_REASON and clears them.
//
//   npx tsx prisma/seed-july-2026-leaves.ts            # dry run
//   npx tsx prisma/seed-july-2026-leaves.ts --commit   # writes
// =============================================================================

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const db = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
})

const COMMIT = process.argv.includes("--commit")
const SEED_REASON = "July 2026 leave register (seeded)"
const YEAR = 2026

type Kind = "CL" | "PL" | "LWP" | "WFH"

interface Entry {
  /** First name as it appears in the register. */
  who: string
  days: number[] // days in July 2026
  kind: Kind
  /** True where the register did not state a type and one was inferred. */
  inferred?: boolean
}

const REGISTER: Entry[] = [
  { who: "Mridul", days: [1], kind: "CL", inferred: true },
  { who: "Mridul", days: [9], kind: "WFH" },

  { who: "Hemant", days: [15, 17], kind: "CL" },
  { who: "Hemant", days: [30], kind: "PL" },

  { who: "Ayushi", days: [15], kind: "CL" },
  { who: "Ayushi", days: [27], kind: "WFH" },

  { who: "Guruprasad", days: [27], kind: "CL", inferred: true },
  { who: "Gavisha", days: [31], kind: "CL", inferred: true },

  { who: "Karan", days: [9], kind: "WFH" },

  { who: "Komal", days: [7, 28], kind: "LWP", inferred: true },
  { who: "Dev", days: [6, 7], kind: "LWP", inferred: true },
]

/** July 2026, as a UTC date - leave columns are @db.Date. */
const july = (day: number) => new Date(Date.UTC(YEAR, 6, day))

async function main() {
  const employees = await db.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, managerId: true },
  })
  // Trimmed: at least one record is stored as "Dev " with a trailing space, and
  // an exact match silently drops that person's whole row.
  const find = (first: string) =>
    employees.find((e) => e.firstName.trim().toLowerCase() === first.trim().toLowerCase())

  const leaveTypes = await db.leaveType.findMany({ select: { id: true, code: true, isPaid: true } })
  const typeByCode = new Map(leaveTypes.map((t) => [t.code, t]))

  // Whoever approves when the person has no manager on record.
  const hr = employees.find((e) => e.firstName === "Ayushi")
  const admin = employees.find((e) => e.firstName === "Manpreet")

  const leaveRows: {
    employeeId: string
    who: string
    typeCode: string
    typeId: string
    date: Date
    approverId: string | null
    isPaid: boolean
  }[] = []
  const wfhRows: { employeeId: string; who: string; date: Date; approverId: string | null }[] = []
  const problems: string[] = []

  for (const entry of REGISTER) {
    const emp = find(entry.who)
    if (!emp) {
      problems.push(`no active employee named "${entry.who}" - ${entry.days.length} row(s) skipped`)
      continue
    }
    // An approver who is the applicant would be nonsense on their own leave.
    const approver =
      (emp.managerId && emp.managerId !== emp.id ? emp.managerId : null) ??
      (hr && hr.id !== emp.id ? hr.id : null) ??
      (admin && admin.id !== emp.id ? admin.id : null)

    for (const day of entry.days) {
      if (entry.kind === "WFH") {
        wfhRows.push({
          employeeId: emp.id,
          who: `${emp.firstName} ${emp.lastName}`.trim(),
          date: july(day),
          approverId: approver,
        })
        continue
      }
      const type = typeByCode.get(entry.kind)
      if (!type) {
        problems.push(`leave type ${entry.kind} missing`)
        continue
      }
      leaveRows.push({
        employeeId: emp.id,
        who: `${emp.firstName} ${emp.lastName}`.trim(),
        typeCode: entry.kind,
        typeId: type.id,
        date: july(day),
        approverId: approver,
        isPaid: type.isPaid,
      })
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`Leave requests to create: ${leaveRows.length}`)
  for (const r of leaveRows) {
    console.log(`  ${r.date.toISOString().slice(0, 10)}  ${r.typeCode.padEnd(4)} ${r.who}`)
  }
  console.log(`\nWFH requests to create: ${wfhRows.length}`)
  for (const r of wfhRows) {
    console.log(`  ${r.date.toISOString().slice(0, 10)}  WFH  ${r.who}`)
  }

  const inferred = REGISTER.filter((e) => e.inferred)
  if (inferred.length > 0) {
    console.log("\nType INFERRED (the register did not say):")
    for (const e of inferred) {
      console.log(`  ${e.who}: ${e.days.join(", ")} July -> ${e.kind}`)
    }
  }
  if (problems.length > 0) console.log(`\nProblems:\n  ${problems.join("\n  ")}`)

  if (!COMMIT) {
    console.log("\nDRY RUN - nothing written. Re-run with --commit to apply.")
    return
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  const [oldLeave, oldWfh] = await Promise.all([
    db.leaveRequest.deleteMany({ where: { reason: SEED_REASON } }),
    db.wfhRequest.deleteMany({ where: { reason: SEED_REASON } }),
  ])
  console.log(`\nCleared ${oldLeave.count} leave + ${oldWfh.count} WFH row(s) from a previous run.`)

  const approvedAt = new Date()
  for (const r of leaveRows) {
    await db.leaveRequest.create({
      data: {
        employeeId: r.employeeId,
        leaveTypeId: r.typeId,
        startDate: r.date,
        endDate: r.date,
        totalDays: 1,
        reason: SEED_REASON,
        status: "APPROVED",
        approverId: r.approverId,
        approvedAt,
        managerDecision: "APPROVED",
      },
    })

    // Mirror what approval does in leave.service.ts: an approved day is a used
    // day, otherwise the balance shown to the employee is wrong.
    await db.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: r.employeeId,
          leaveTypeId: r.typeId,
          year: YEAR,
        },
      },
      create: { employeeId: r.employeeId, leaveTypeId: r.typeId, year: YEAR, used: 1 },
      update: { used: { increment: 1 } },
    })
  }
  console.log(`Created ${leaveRows.length} leave request(s) and updated balances.`)

  for (const r of wfhRows) {
    await db.wfhRequest.create({
      data: {
        employeeId: r.employeeId,
        date: r.date,
        reason: SEED_REASON,
        status: "APPROVED",
        managerDecision: "APPROVED",
        managerApproverId: r.approverId,
        managerApprovedAt: approvedAt,
        hrApproverId: hr?.id ?? null,
        hrApprovedAt: approvedAt,
      },
    })
  }
  console.log(`Created ${wfhRows.length} WFH request(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
