import "server-only"

import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { z } from "zod"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { departmentDescendantIds, departmentParentError } from "../lib/department-tree"

// Invariants: an active department never sits under an inactive one (deactivating takes the
// subtree along; reactivating brings parents back), and a hard delete needs nothing pointing at it.

const DEPT_SELECT = {
  id: true,
  name: true,
  parentId: true,
  headId: true,
  isActive: true,
  careersTone: true,
  careersJobsLabel: true,
  _count: { select: { employees: true, jobPostings: true, children: true } },
} as const

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  parentId: z.string().uuid().nullish(),
})

type DepartmentRow = {
  id: string
  name: string
  parentId: string | null
  headId: string | null
  isActive: boolean
  careersTone: string | null
  careersJobsLabel: string | null
  _count: { employees: number; jobPostings: number; children: number }
}

const NAME_TAKEN = "A department with this name already exists"

/** `code` is still required and unique in the DB but unused - fill it with something unique. */
function hiddenCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
}

function loadTree() {
  return db.department.findMany({ select: { id: true, parentId: true, isActive: true } })
}

/** `id`'s parents, nearest first, in a tree where it sits under `parentId`. */
function ancestorIds(
  tree: Array<{ id: string; parentId: string | null }>,
  parentId: string | null,
): string[] {
  const parentOf = new Map(tree.map((d) => [d.id, d.parentId]))
  const out: string[] = []
  let cur = parentId
  while (cur && !out.includes(cur)) {
    out.push(cur)
    cur = parentOf.get(cur) ?? null
  }
  return out
}

export async function getDepartments(opts?: {
  includeInactive?: boolean
}): Promise<ActionResult<Array<DepartmentRow & { activeEmployees: number }>>> {
  return runAction(async () => {
    await requireSession()
    const [data, active] = await Promise.all([
      db.department.findMany({
        where: opts?.includeInactive ? {} : { isActive: true },
        orderBy: { name: "asc" },
        select: DEPT_SELECT,
      }),
      // Headcount = active, non-hidden employees, as the directory lists them.
      db.employee.groupBy({
        by: ["departmentId"],
        where: {
          isActive: true,
          departmentId: { not: null },
          NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
        },
        _count: { _all: true },
      }),
    ])
    const activeBy = new Map(active.map((a) => [a.departmentId, a._count._all]))
    return ok(data.map((d) => ({ ...d, activeEmployees: activeBy.get(d.id) ?? 0 })))
  })
}

export async function getDepartment(id: string): Promise<ActionResult<DepartmentRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const dept = await db.department.findUnique({ where: { id }, select: DEPT_SELECT })
    if (!dept) return fail("Not found")
    return ok(dept)
  })
}

export async function createDepartment(input: {
  name: string
  parentId?: string | null
}): Promise<ActionResult<DepartmentRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const parentId = parsed.data.parentId || null

    if (parentId) {
      const tree = await loadTree()
      const err = departmentParentError(tree, null, parentId)
      if (err) return fail(err)
      if (!tree.find((d) => d.id === parentId)?.isActive)
        return fail("Activate the parent department first")
    }

    try {
      const dept = await db.department.create({
        data: { name: parsed.data.name, code: hiddenCode(), parentId },
        select: DEPT_SELECT,
      })
      return ok(dept)
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return fail(NAME_TAKEN)
      throw e
    }
  })
}

export async function updateDepartment(
  id: string,
  input: {
    name?: string
    parentId?: string | null
    headId?: string | null
    isActive?: boolean
    careersTone?: string | null
    careersJobsLabel?: string | null
  },
): Promise<ActionResult<DepartmentRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const tree = await loadTree()
    const current = tree.find((d) => d.id === id)
    if (!current) return fail("Department not found")

    const data: Record<string, string | null | boolean> = {}
    if (input.name !== undefined) {
      const name = String(input.name).trim()
      if (!name) return fail("Name is required")
      data.name = name
    }
    if (input.headId !== undefined) data.headId = input.headId || null
    if (input.isActive !== undefined) data.isActive = !!input.isActive
    if (input.careersTone !== undefined) {
      const tone = input.careersTone
      data.careersTone = tone === "red" || tone === "teal" ? tone : null
    }
    if (input.careersJobsLabel !== undefined) {
      const label = typeof input.careersJobsLabel === "string" ? input.careersJobsLabel.trim() : ""
      data.careersJobsLabel = label.length > 0 ? label : null
    }

    let parentId = current.parentId
    if (input.parentId !== undefined) {
      parentId = input.parentId || null
      const err = departmentParentError(tree, id, parentId)
      if (err) return fail(err)
      data.parentId = parentId
    }
    // Moving an active department under an inactive one would break the rule
    // below; an explicit isActive=true instead reactivates the new parents.
    if (
      input.parentId !== undefined &&
      parentId &&
      current.isActive &&
      input.isActive === undefined &&
      !tree.find((d) => d.id === parentId)?.isActive
    )
      return fail("Activate the parent department first")

    const below = input.isActive === false ? [...departmentDescendantIds(tree, id)] : []
    const above = input.isActive === true ? ancestorIds(tree, parentId) : []

    try {
      const [dept] = await db.$transaction([
        db.department.update({ where: { id }, data, select: DEPT_SELECT }),
        db.department.updateMany({ where: { id: { in: below } }, data: { isActive: false } }),
        db.department.updateMany({ where: { id: { in: above } }, data: { isActive: true } }),
      ])
      return ok(dept)
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return fail(NAME_TAKEN)
      throw e
    }
  })
}

/** Soft-deactivate (with the subtree) by default; permanent=true hard-deletes only when nothing
 *  references the department. */
export async function deleteDepartment(
  id: string,
  permanent = false,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const dept = await db.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, jobPostings: true, children: true } } },
    })
    if (!dept) return fail("Department not found")

    if (permanent) {
      if (dept._count.children > 0)
        return fail(
          `Cannot permanently delete: it has ${dept._count.children} sub-department(s). Move or delete them first.`,
        )
      if (dept._count.employees > 0 || dept._count.jobPostings > 0)
        return fail(
          `Cannot permanently delete: ${dept._count.employees} employee(s) and ${dept._count.jobPostings} job posting(s) reference this department. Deactivate instead.`,
        )
      await db.department.delete({ where: { id } })
      return ok({ message: "Department deleted permanently" })
    }

    const below = [...departmentDescendantIds(await loadTree(), id)]
    await db.department.updateMany({
      where: { id: { in: [id, ...below] } },
      data: { isActive: false },
    })
    return ok({
      message: `Department deactivated. ${dept._count.employees} employee(s) still assigned.`,
    })
  })
}
