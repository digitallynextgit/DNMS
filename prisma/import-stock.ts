/**
 * One-off import of the root stock.xlsx into the stock register.
 *
 *   pnpm db:stock              # dry run - prints what WOULD be written
 *   pnpm db:stock --write      # actually write
 *
 * DRY RUN BY DEFAULT, and it refuses to run at all once any stock rows exist
 * (the HR upload dialog in /stock is the ongoing path; this exists only to
 * seed the initial workbook). Use the pnpm script, not a bare `npx tsx` - this
 * imports @/server/db, which requires the react-server condition (see
 * prisma/backfill-hr-checklists.ts for the full story).
 *
 * Matching mirrors features/stock/server/stock.service.ts: holder names are
 * matched against EVERY employee, active and deactivated - full-name equality
 * first, then a bare first name when exactly one employee carries it. Anyone
 * unmatched is imported with the name as typed (never skipped) for HR to link
 * in the UI later.
 */
import "dotenv/config"
import path from "node:path"
import * as XLSX from "xlsx"
import { db } from "@/server/db"
import { runWithTenant } from "@/server/tenant-context"
import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG } from "@/lib/tenant-url"
import { normalizeName, parseStockWorkbook } from "@/features/stock/lib/parse"

const WRITE = process.argv.includes("--write")

async function main() {
  const file = path.join(process.cwd(), "stock.xlsx")
  const wb = XLSX.readFile(file, { cellDates: true })
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const rows = ws
      ? XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(ws, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        })
      : []
    return { name, rows: rows.map((r) => (Array.isArray(r) ? r : [])) }
  })

  const parsed = parseStockWorkbook(sheets)
  console.log(`Parsed ${file}:`)
  console.log(`  catalogue rows: ${parsed.items.length}`)
  console.log(`  issue rows:     ${parsed.issues.length}`)
  for (const s of parsed.skipped) console.log(`  skipped: ${s}`)

  await runWithTenant({ tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }, async () => {
    const existing = await db.stockItem.count()
    if (existing > 0) {
      console.error(
        `\nREFUSING: ${existing} stock item(s) already exist - this seeder is one-off. ` +
          `Use the Import button on /stock for further uploads.`,
      )
      process.exitCode = 1
      return
    }

    // Same matcher as the service: every employee, any status.
    const employees = await db.employee.findMany({
      select: { id: true, firstName: true, lastName: true, isActive: true },
    })
    const byFull = new Map<string, string>()
    const byFirst = new Map<string, string | "AMBIGUOUS">()
    for (const e of employees) {
      byFull.set(normalizeName(`${e.firstName} ${e.lastName}`), e.id)
      const first = normalizeName(e.firstName)
      if (!first) continue
      byFirst.set(first, byFirst.has(first) ? "AMBIGUOUS" : e.id)
    }
    const match = (holder: string): string | null => {
      const norm = normalizeName(holder)
      const full = byFull.get(norm)
      if (full) return full
      const first = byFirst.get(norm)
      return first && first !== "AMBIGUOUS" ? first : null
    }

    let linked = 0
    const unmatched = new Set<string>()
    const plan = parsed.issues.map((issue) => {
      const employeeId = match(issue.holderName)
      if (employeeId) linked++
      else unmatched.add(issue.holderName)
      return { ...issue, employeeId }
    })

    console.log(`\nEmployees on file: ${employees.length} (incl. deactivated)`)
    console.log(`Issue rows linking to an employee: ${linked}/${plan.length}`)
    if (unmatched.size > 0) {
      console.log(`Kept as plain names (link in the UI later): ${[...unmatched].join(", ")}`)
    }

    if (!WRITE) {
      console.log("\nDRY RUN - nothing written. Re-run with --write to import.")
      return
    }

    // Items: the catalogue sheet first, then any issuance column it missed.
    const itemIdByName = new Map<string, string>()
    for (const item of parsed.items) {
      const created = await db.stockItem.create({
        data: {
          name: item.name,
          pricePerPiece: item.pricePerPiece,
          purchasedQty: item.purchasedQty ?? 0,
        },
        select: { id: true },
      })
      itemIdByName.set(normalizeName(item.name), created.id)
    }
    for (const issue of plan) {
      const key = normalizeName(issue.itemName)
      if (itemIdByName.has(key)) continue
      const created = await db.stockItem.create({
        data: { name: issue.itemName, purchasedQty: 0 },
        select: { id: true },
      })
      itemIdByName.set(key, created.id)
    }

    await db.stockIssue.createMany({
      data: plan.map((issue) => ({
        itemId: itemIdByName.get(normalizeName(issue.itemName))!,
        holderName: issue.holderName,
        employeeId: issue.employeeId,
        quantity: issue.quantity,
        issuedOn: issue.issuedOn ? new Date(issue.issuedOn) : null,
      })),
    })

    // Sanity check the sheet's own "Stock left" row against the computed one.
    const totals = await db.stockIssue.groupBy({ by: ["itemId"], _sum: { quantity: true } })
    const items = await db.stockItem.findMany()
    console.log("\nImported. Computed stock left (compare with the sheet's 'Stock left' row):")
    for (const i of items) {
      const issued = totals.find((t) => t.itemId === i.id)?._sum.quantity ?? 0
      console.log(
        `  ${i.name}: purchased ${i.purchasedQty} - issued ${issued} = ${i.purchasedQty - issued}`,
      )
    }
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => process.exit())
