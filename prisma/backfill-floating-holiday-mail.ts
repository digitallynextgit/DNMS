/**
 * One-off backfill: send the floating-holiday application letter for requests
 * submitted BEFORE the email existed.
 *
 *   npx tsx --conditions=react-server prisma/backfill-floating-holiday-mail.ts          # dry run
 *   npx tsx --conditions=react-server prisma/backfill-floating-holiday-mail.ts --send   # actually send
 *
 * The `react-server` condition makes the `server-only` guard a no-op so this
 * script can reuse the feature's mail module (which chains through server-only
 * imports) from plain Node/tsx. Without it the import throws before anything runs.
 *
 * DRY RUN BY DEFAULT. Nothing leaves the machine without `--send`.
 *
 * Only PENDING requests are eligible: an already-decided request does not need a
 * letter asking its approver to decide, and for the approved ones on file the
 * holiday date has long passed. Pass --include-approved to widen it anyway.
 *
 * Letters go out per tenant (runWithTenant), because the HR inbox, company
 * website and social links in the signature are all per-tenant config - resolving
 * them unscoped would sign every letter with the wrong company.
 *
 * `usedCount` is reconstructed, not guessed: an employee's active selections for
 * the year are ranked by createdAt, so each letter states the same "Nth of 3"
 * the live path would have stated at the time it was submitted.
 */
import "dotenv/config"
// Reuse the app's configured client (Prisma 7 driver adapter); a bare
// `new PrismaClient()` throws.
import type { LeaveStatus } from "@prisma/client"
import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { sendEmailAs } from "@/lib/mailer"
import { prepareFloatingHolidayLetter } from "@/features/attendance/server/floating-holiday-mail"
import { FLOATING_HOLIDAY_LIMIT } from "@/lib/constants"

const SEND = process.argv.includes("--send")
const INCLUDE_APPROVED = process.argv.includes("--include-approved")

// Statuses that count against the yearly allowance - must match the API route.
const ACTIVE: LeaveStatus[] = ["PENDING", "APPROVED"]

async function main() {
  const statuses: LeaveStatus[] = INCLUDE_APPROVED ? ACTIVE : ["PENDING"]

  const rows = await runUnscoped("backfill: floating-holiday application letters", () =>
    db.floatingHolidaySelection.findMany({
      where: { status: { in: statuses } },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        holiday: { select: { name: true, date: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  )

  if (rows.length === 0) {
    console.log("Nothing to do - no matching floating-holiday requests.")
    return
  }

  // Rank each employee's active selections for the year, so the letter can say
  // "my Nth floating holiday of 3" exactly as the live path would have.
  const rank = new Map<string, number>()
  const seen = new Map<string, number>()
  const ranking = await runUnscoped("backfill: floating-holiday allowance ranking", () =>
    db.floatingHolidaySelection.findMany({
      where: { status: { in: ACTIVE } },
      select: { id: true, employeeId: true, year: true },
      orderBy: { createdAt: "asc" },
    }),
  )
  for (const r of ranking) {
    const key = `${r.employeeId}:${r.year}`
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    rank.set(r.id, n)
  }

  // Group by tenant: the signature and HR inbox are per-tenant config.
  const byTenant = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byTenant.has(r.tenantId)) byTenant.set(r.tenantId, [])
    byTenant.get(r.tenantId)!.push(r)
  }

  console.log(
    `${SEND ? "SENDING" : "DRY RUN"} - ${rows.length} request(s) across ${byTenant.size} tenant(s)` +
      `${INCLUDE_APPROVED ? " (PENDING + APPROVED)" : " (PENDING only)"}\n`,
  )

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const [tenantId, tenantRows] of byTenant) {
    const tenant = await runUnscoped("backfill: resolve tenant slug", () =>
      db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } }),
    )
    if (!tenant) {
      console.log(`! tenant ${tenantId} not found - skipping ${tenantRows.length} request(s)`)
      skipped += tenantRows.length
      continue
    }
    console.log(`── ${tenant.name} (${tenant.slug}) ──`)

    await runWithTenant({ tenantId, slug: tenant.slug }, async () => {
      for (const row of tenantRows) {
        const who = `${row.employee.firstName} ${row.employee.lastName ?? ""}`.trim()
        const label = `${who} · ${row.holiday.name} ${row.holiday.date.toISOString().slice(0, 10)}`

        let letter
        try {
          letter = await prepareFloatingHolidayLetter({
            applicantId: row.employeeId,
            selectionId: row.id,
            holidayName: row.holiday.name,
            holidayDate: row.holiday.date,
            reason: row.reason,
            usedCount: rank.get(row.id) ?? 1,
            limit: FLOATING_HOLIDAY_LIMIT,
            year: row.year,
          })
        } catch (err) {
          console.log(`  ✗ ${label} - could not build letter:`, err)
          failed++
          continue
        }

        if (!letter) {
          console.log(`  - ${label} - SKIPPED (no approver to address it to)`)
          skipped++
          continue
        }

        const cc = letter.cc?.length ? ` cc ${letter.cc.join(", ")}` : ""
        if (!SEND) {
          console.log(`  · ${label}\n      to ${letter.to}${cc}\n      "${letter.subject}"`)
          continue
        }

        try {
          await sendEmailAs(letter.applicantId, {
            to: letter.to,
            cc: letter.cc,
            subject: letter.subject,
            html: letter.html,
            text: letter.text,
            replyTo: letter.replyTo,
            messageId: letter.messageId,
            references: letter.references,
            profile: "notifications",
          })
          console.log(`  ✓ ${label} -> ${letter.to}${cc}`)
          sent++
        } catch (err) {
          console.log(`  ✗ ${label} - send failed:`, err)
          failed++
        }
      }
    })
    console.log("")
  }

  if (SEND) {
    console.log(`Done. sent=${sent} skipped=${skipped} failed=${failed}`)
  } else {
    console.log(
      `Dry run complete - nothing sent. ${rows.length - skipped} letter(s) would go out.\n` +
        `Re-run with --send to actually send.`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
