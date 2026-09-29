import "server-only"

import { db } from "@/server/db"
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
  type CreateItemInput,
  type UpdateItemInput,
  type CreateIssueInput,
  type UpdateIssueInput,
  type ImportInput,
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
      db.stockItem.findMany({ orderBy: { name: "asc" } }),
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
          ...(parsed.data.purchasedQty !== undefined
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
          data: { name: issue.itemName, purchasedQty: 0 },
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
