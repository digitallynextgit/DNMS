import "server-only"

import { db } from "@/server/db"
import type { Prisma } from "@prisma/client"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta, type PaginationMeta } from "@/lib/pagination"
import { requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { normalizeName } from "../lib/parse"
import {
  createItemSchema,
  updateItemSchema,
  createIssueSchema,
  updateIssueSchema,
  importSchema,
  registerRowSchema,
  type CreateItemInput,
  type UpdateItemInput,
  type CreateIssueInput,
  type UpdateIssueInput,
  type ImportInput,
  type RegisterRowInput,
} from "../schemas/stock.schema"

// =============================================================================
// HRMS stock register.
//
// Read = employee:read (it lists who holds what, HR-facing), write =
// employee:write. "Stock left" is computed here (purchased - issued) so the
// number can never drift from the ledger.
// =============================================================================

const ISSUE_SELECT = {
  id: true,
  holderName: true,
  employeeId: true,
  quantity: true,
  issuedOn: true,
  notes: true,
  createdAt: true,
  item: { select: { id: true, name: true } },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      isActive: true,
      profilePhoto: true,
    },
  },
} as const

export type StockIssueRow = {
  id: string
  holderName: string
  employeeId: string | null
  quantity: number
  issuedOn: Date | null
  notes: string | null
  createdAt: Date
  item: { id: string; name: string }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    isActive: boolean
    profilePhoto: string | null
  } | null
}

export type StockItemRow = {
  id: string
  name: string
  pricePerPiece: number | null
  purchasedQty: number
  issuedQty: number
  leftQty: number
  notes: string | null
}

// ---------------------------------------------------------------------------
// Employee matching for uploaded names.
//
// Sheets say "Deepak Goel" or just "Ayushi". Match against EVERY employee -
// active AND deactivated ("even deactivated" is a requirement: the person who
// held the item may have left since). Full-name equality wins; a bare first
// name links only when exactly ONE employee carries it - an ambiguous name is
// left unlinked for HR to resolve by hand, never guessed.
// ---------------------------------------------------------------------------
async function buildEmployeeMatcher(): Promise<(holderName: string) => string | null> {
  const employees = await db.employee.findMany({
    select: { id: true, firstName: true, lastName: true },
  })
  const byFull = new Map<string, string>()
  const byFirst = new Map<string, string | "AMBIGUOUS">()
  for (const e of employees) {
    byFull.set(normalizeName(`${e.firstName} ${e.lastName}`), e.id)
    const first = normalizeName(e.firstName)
    if (!first) continue
    byFirst.set(first, byFirst.has(first) ? "AMBIGUOUS" : e.id)
  }
  return (holderName: string) => {
    const norm = normalizeName(holderName)
    if (!norm) return null
    const full = byFull.get(norm)
    if (full) return full
    const first = byFirst.get(norm)
    return first && first !== "AMBIGUOUS" ? first : null
  }
}

// ---------------------------------------------------------------------------
// Items (catalogue)
// ---------------------------------------------------------------------------

export async function getStockItems(): Promise<ActionResult<StockItemRow[]>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const [items, issued] = await Promise.all([
      // Sheet column order first (position), name as the tie-breaker.
      db.stockItem.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
      db.stockIssue.groupBy({ by: ["itemId"], _sum: { quantity: true } }),
    ])
    const issuedByItem = new Map(issued.map((g) => [g.itemId, g._sum.quantity ?? 0]))
    return ok(
      items.map((i) => {
        const issuedQty = issuedByItem.get(i.id) ?? 0
        return {
          id: i.id,
          name: i.name,
          pricePerPiece: i.pricePerPiece === null ? null : Number(i.pricePerPiece),
          purchasedQty: i.purchasedQty,
          issuedQty,
          leftQty: i.purchasedQty - issuedQty,
          notes: i.notes,
        }
      }),
    )
  })
}

export async function createStockItem(
  input: CreateItemInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createItemSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    try {
      const item = await db.stockItem.create({
        data: {
          name: parsed.data.name,
          pricePerPiece: parsed.data.pricePerPiece ?? null,
          purchasedQty: parsed.data.purchasedQty ?? 0,
          notes: parsed.data.notes || null,
        },
        select: { id: true },
      })
      return ok({ id: item.id })
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("An item with that name already exists")
      throw e
    }
  })
}

export async function updateStockItem(
  id: string,
  input: UpdateItemInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = updateItemSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const existing = await db.stockItem.findFirst({ where: { id }, select: { id: true } })
    if (!existing) return fail("Item not found")
    try {
      await db.stockItem.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.pricePerPiece !== undefined
            ? { pricePerPiece: parsed.data.pricePerPiece }
            : {}),
          // A restock ADDS pieces (a purchase is an event); an absolute
          // purchasedQty is a correction of the total. Restock wins when both
          // arrive, so a stale dialog cannot silently rewrite the total.
          ...(parsed.data.restockBy
            ? { purchasedQty: { increment: parsed.data.restockBy } }
            : parsed.data.purchasedQty !== undefined
              ? { purchasedQty: parsed.data.purchasedQty }
              : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
        },
      })
      return ok({ id })
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("An item with that name already exists")
      throw e
    }
  })
}

// ---------------------------------------------------------------------------
// Issues (the register)
// ---------------------------------------------------------------------------

export async function getStockIssues(filters: {
  q?: string
  itemId?: string
  unlinkedOnly?: boolean
  page?: number
  limit?: number
}): Promise<ActionResult<{ rows: StockIssueRow[]; meta: PaginationMeta }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const { page, limit, skip, take } = resolvePagination(
      { page: filters.page, limit: filters.limit },
      25,
    )
    const where = {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.unlinkedOnly ? { employeeId: null } : {}),
      ...(filters.q
        ? {
            OR: [
              { holderName: { contains: filters.q, mode: "insensitive" as const } },
              { item: { name: { contains: filters.q, mode: "insensitive" as const } } },
              { employee: { firstName: { contains: filters.q, mode: "insensitive" as const } } },
              { employee: { lastName: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      db.stockIssue.findMany({
        where,
        orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
        skip,
        take,
        select: ISSUE_SELECT,
      }),
      db.stockIssue.count({ where }),
    ])
    return ok({ rows: rows as StockIssueRow[], meta: paginationMeta(total, page, limit) })
  })
}

/**
 * Bulk action on selected register entries: link them all to one employee,
 * unlink them, or delete them. One request instead of N PATCHes from the
 * selection bar, and the whole batch is scoped to ids that actually exist
 * here (the tenant guard scopes the reads and writes).
 */
export async function bulkStockIssues(input: {
  ids: string[]
  action: "link" | "unlink" | "delete"
  employeeId?: string
}): Promise<ActionResult<{ affected: number }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const ids = Array.from(new Set(input.ids ?? [])).filter(
      (id) => typeof id === "string" && id.length > 0,
    )
    if (ids.length === 0 || ids.length > 500) return fail("Select between 1 and 500 entries")

    if (input.action === "link") {
      if (!input.employeeId) return fail("Pick an employee to link to")
      // Any status, INCLUDING deactivated - but it must be this tenant's employee.
      const emp = await db.employee.findFirst({
        where: { id: input.employeeId },
        select: { id: true },
      })
      if (!emp) return fail("That employee does not exist here")
      const res = await db.stockIssue.updateMany({
        where: { id: { in: ids } },
        data: { employeeId: emp.id },
      })
      return ok({ affected: res.count })
    }
    if (input.action === "unlink") {
      const res = await db.stockIssue.updateMany({
        where: { id: { in: ids } },
        data: { employeeId: null },
      })
      return ok({ affected: res.count })
    }
    const res = await db.stockIssue.deleteMany({ where: { id: { in: ids } } })
    return ok({ affected: res.count })
  })
}

export async function createStockIssue(
  input: CreateIssueInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createIssueSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)

    const item = await db.stockItem.findFirst({
      where: { id: parsed.data.itemId },
      select: { id: true },
    })
    if (!item) return fail("Item not found")
    if (parsed.data.employeeId) {
      // Any status, INCLUDING deactivated - but it must be this tenant's employee.
      const emp = await db.employee.findFirst({
        where: { id: parsed.data.employeeId },
        select: { id: true },
      })
      if (!emp) return fail("That employee does not exist here")
    }

    const issue = await db.stockIssue.create({
      data: {
        itemId: item.id,
        holderName: parsed.data.holderName,
        employeeId: parsed.data.employeeId ?? null,
        quantity: parsed.data.quantity,
        issuedOn: parsed.data.issuedOn ? new Date(parsed.data.issuedOn) : null,
        notes: parsed.data.notes || null,
      },
      select: { id: true },
    })
    return ok({ id: issue.id })
  })
}

export async function updateStockIssue(
  id: string,
  input: UpdateIssueInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = updateIssueSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)

    const existing = await db.stockIssue.findFirst({ where: { id }, select: { id: true } })
    if (!existing) return fail("Register entry not found")

    if (parsed.data.employeeId) {
      const emp = await db.employee.findFirst({
        where: { id: parsed.data.employeeId },
        select: { id: true },
      })
      if (!emp) return fail("That employee does not exist here")
    }

    await db.stockIssue.update({
      where: { id },
      data: {
        ...(parsed.data.holderName !== undefined ? { holderName: parsed.data.holderName } : {}),
        // null unlinks, a string links, absent leaves it alone.
        ...(parsed.data.employeeId !== undefined ? { employeeId: parsed.data.employeeId } : {}),
        ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
        ...(parsed.data.issuedOn !== undefined
          ? { issuedOn: parsed.data.issuedOn ? new Date(parsed.data.issuedOn) : null }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      },
    })
    return ok({ id })
  })
}

export async function deleteStockIssue(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const existing = await db.stockIssue.findFirst({ where: { id }, select: { id: true } })
    if (!existing) return fail("Register entry not found")
    await db.stockIssue.delete({ where: { id } })
    return ok({ id })
  })
}

// ---------------------------------------------------------------------------
// Bulk import (the upload dialog's POST). Additive by design: it is a ledger,
// so uploading appends issues and adds purchases. Re-uploading the same file
// therefore double-counts - the dialog says so before HR confirms.
// ---------------------------------------------------------------------------

export interface ImportResult {
  itemsCreated: number
  itemsRestocked: number
  issuesCreated: number
  linked: number
  unlinked: number
}

export async function importStock(input: ImportInput): Promise<ActionResult<ImportResult>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = importSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const { items, issues } = parsed.data
    if (items.length === 0 && issues.length === 0) return fail("Nothing to import")

    const result: ImportResult = {
      itemsCreated: 0,
      itemsRestocked: 0,
      issuesCreated: 0,
      linked: 0,
      unlinked: 0,
    }

    // Item names arrive from two places (catalogue rows + issuance columns);
    // resolve them all to ids, creating what does not exist yet.
    const existing = await db.stockItem.findMany({ select: { id: true, name: true } })
    const itemIdByName = new Map(existing.map((i) => [normalizeName(i.name), i.id]))
    // New items append after the current columns, keeping the sheet's order.
    let nextPosition =
      (await db.stockItem.aggregate({ _max: { position: true } }))._max.position ?? 0

    for (const item of items) {
      const key = normalizeName(item.name)
      const known = itemIdByName.get(key)
      if (known) {
        // A catalogue row for a known item is a RESTOCK: quantities add, and a
        // price on the sheet becomes the current price.
        await db.stockItem.update({
          where: { id: known },
          data: {
            ...(item.purchasedQty ? { purchasedQty: { increment: item.purchasedQty } } : {}),
            ...(item.pricePerPiece !== null ? { pricePerPiece: item.pricePerPiece } : {}),
          },
        })
        if (item.purchasedQty) result.itemsRestocked++
      } else {
        const created = await db.stockItem.create({
          data: {
            name: item.name,
            position: ++nextPosition,
            pricePerPiece: item.pricePerPiece,
            purchasedQty: item.purchasedQty ?? 0,
          },
          select: { id: true },
        })
        itemIdByName.set(key, created.id)
        result.itemsCreated++
      }
    }

    for (const issue of issues) {
      const key = normalizeName(issue.itemName)
      if (!itemIdByName.has(key)) {
        // An issuance column with no catalogue row: the item plainly exists,
        // HR just never recorded the purchase. Create it with zero purchased
        // so the register is complete; "left" goes negative until HR fills
        // the purchase in, which is the honest state of the books.
        const created = await db.stockItem.create({
          data: { name: issue.itemName, position: ++nextPosition, purchasedQty: 0 },
          select: { id: true },
        })
        itemIdByName.set(key, created.id)
        result.itemsCreated++
      }
    }

    const matchEmployee = await buildEmployeeMatcher()
    const data = issues.map((issue) => {
      const employeeId = matchEmployee(issue.holderName)
      if (employeeId) result.linked++
      else result.unlinked++
      return {
        itemId: itemIdByName.get(normalizeName(issue.itemName))!,
        holderName: issue.holderName,
        employeeId,
        quantity: issue.quantity,
        issuedOn: issue.issuedOn ? new Date(issue.issuedOn) : null,
      }
    })
    if (data.length > 0) {
      await db.stockIssue.createMany({ data })
      result.issuesCreated = data.length
    }

    return ok(result)
  })
}

// ---------------------------------------------------------------------------
// Employee search for the link dialog. INCLUDES deactivated employees - the
// person a sheet names may have left; linking their history is the point.
// ---------------------------------------------------------------------------

export type LinkableEmployee = {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  isActive: boolean
  profilePhoto: string | null
}

export async function searchLinkableEmployees(
  q: string,
): Promise<ActionResult<LinkableEmployee[]>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const query = q.trim()
    const rows = await db.employee.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { employeeNo: { contains: query, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        isActive: true,
        profilePhoto: true,
      },
    })
    return ok(rows)
  })
}

// ---------------------------------------------------------------------------
// The MATRIX view: the register pivoted to mirror the uploaded sheet - one
// row per (holder, employee link, date), one column per item, quantities in
// the cells. The flat per-issue ledger stays the source of truth; this only
// changes how it is read and how a row-edit is written back.
// ---------------------------------------------------------------------------

export type StockMatrixRow = {
  /** Stable client key for the group (holder + employee + date). */
  key: string
  holderName: string
  issuedOn: Date | null
  employee: StockIssueRow["employee"]
  /** Every underlying ledger entry in this row (for bulk link/unlink/delete). */
  issueIds: string[]
  /** itemId → summed quantity + the ledger entries behind it. */
  cells: Record<string, { quantity: number; issueIds: string[] }>
}

function matrixKey(holderName: string, employeeId: string | null, issuedOn: Date | null): string {
  return [holderName, employeeId ?? "", issuedOn ? issuedOn.toISOString().slice(0, 10) : ""].join(
    "§",
  )
}

export async function getStockMatrix(filters: {
  q?: string
  itemId?: string
  unlinkedOnly?: boolean
  page?: number
  limit?: number
}): Promise<ActionResult<{ rows: StockMatrixRow[]; meta: PaginationMeta }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const { page, limit, skip, take } = resolvePagination(
      { page: filters.page, limit: filters.limit },
      25,
    )
    const where = {
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.unlinkedOnly ? { employeeId: null } : {}),
      ...(filters.q
        ? {
            OR: [
              { holderName: { contains: filters.q, mode: "insensitive" as const } },
              { employee: { firstName: { contains: filters.q, mode: "insensitive" as const } } },
              { employee: { lastName: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    }

    // Page over GROUPS, not ledger entries, so one sheet row = one table row.
    const [pageGroups, allGroups] = await Promise.all([
      db.stockIssue.groupBy({
        by: ["holderName", "employeeId", "issuedOn"],
        where,
        orderBy: [{ issuedOn: "desc" }, { holderName: "asc" }],
        skip,
        take,
      }),
      db.stockIssue.groupBy({ by: ["holderName", "employeeId", "issuedOn"], where }),
    ])

    if (pageGroups.length === 0) {
      return ok({ rows: [], meta: paginationMeta(allGroups.length, page, limit) })
    }

    // All ledger entries behind this page's groups, in one query. NOTE: this
    // deliberately drops the item filter - a row filtered BY an item still
    // shows its other columns, like reading the sheet.
    const entries = await db.stockIssue.findMany({
      where: {
        OR: pageGroups.map((g) => ({
          holderName: g.holderName,
          employeeId: g.employeeId,
          issuedOn: g.issuedOn,
        })),
      },
      select: ISSUE_SELECT,
    })

    const rowByKey = new Map<string, StockMatrixRow>()
    for (const g of pageGroups) {
      const key = matrixKey(g.holderName, g.employeeId, g.issuedOn)
      rowByKey.set(key, {
        key,
        holderName: g.holderName,
        issuedOn: g.issuedOn,
        employee: null,
        issueIds: [],
        cells: {},
      })
    }
    for (const e of entries) {
      const row = rowByKey.get(matrixKey(e.holderName, e.employeeId, e.issuedOn))
      if (!row) continue
      row.employee = e.employee
      row.issueIds.push(e.id)
      const cell = (row.cells[e.item.id] ??= { quantity: 0, issueIds: [] })
      cell.quantity += e.quantity
      cell.issueIds.push(e.id)
    }

    return ok({
      rows: [...rowByKey.values()],
      meta: paginationMeta(allGroups.length, page, limit),
    })
  })
}

/**
 * Write ONE matrix row back: holder, date, link, and a quantity per item.
 * Reconciled against the ledger entries the client saw - per cell: 0 deletes
 * them, a quantity updates the first (and drops accidental duplicates), a
 * quantity with no entries creates one.
 */
export async function updateStockRegisterRow(
  input: RegisterRowInput,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = registerRowSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const { holderName, employeeId, issuedOn, cells } = parsed.data

    if (employeeId) {
      // Any status, INCLUDING deactivated - but it must be this tenant's employee.
      const emp = await db.employee.findFirst({ where: { id: employeeId }, select: { id: true } })
      if (!emp) return fail("That employee does not exist here")
    }

    // Everything the client claims to be editing must still exist HERE (the
    // tenant guard scopes this read) - a stale dialog fails loudly, not partially.
    const claimedIds = cells.flatMap((c) => c.issueIds)
    if (new Set(claimedIds).size !== claimedIds.length) return fail("Duplicate entries in the row")
    const [foundIssues, foundItems] = await Promise.all([
      db.stockIssue.findMany({ where: { id: { in: claimedIds } }, select: { id: true } }),
      db.stockItem.findMany({
        where: { id: { in: cells.map((c) => c.itemId) } },
        select: { id: true },
      }),
    ])
    if (foundIssues.length !== claimedIds.length)
      return fail("This row changed since it was opened - reload and try again")
    if (foundItems.length !== new Set(cells.map((c) => c.itemId)).size)
      return fail("An item in this row no longer exists")

    const date = issuedOn ? new Date(issuedOn) : null
    const shared = { holderName, employeeId, issuedOn: date }
    const ops: Prisma.PrismaPromise<unknown>[] = []
    for (const cell of cells) {
      const [first, ...rest] = cell.issueIds
      if (cell.quantity === 0) {
        if (cell.issueIds.length > 0)
          ops.push(db.stockIssue.deleteMany({ where: { id: { in: cell.issueIds } } }))
      } else if (first) {
        ops.push(
          db.stockIssue.update({
            where: { id: first },
            data: { ...shared, quantity: cell.quantity },
          }),
        )
        if (rest.length > 0) ops.push(db.stockIssue.deleteMany({ where: { id: { in: rest } } }))
      } else {
        ops.push(
          db.stockIssue.create({
            data: { ...shared, itemId: cell.itemId, quantity: cell.quantity },
          }),
        )
      }
    }
    if (ops.length === 0) return fail("Nothing to change")
    await db.$transaction(ops)
    return ok({ ok: true as const })
  })
}
