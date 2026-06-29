import "server-only"

import { db } from "@/server/db"
import { z } from "zod"
import { PERMISSIONS } from "@/lib/constants"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"

const JOBROLE_SELECT = {
  id: true,
  name: true,
  departmentId: true,
  isActive: true,
  department: { select: { id: true, name: true, code: true } },
  _count: { select: { employees: true } },
} as const

type JobRoleRow = {
  id: string
  name: string
  departmentId: string
  isActive: boolean
  department: { id: string; name: string; code: string }
  _count: { employees: number }
}

const createSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  departmentId: z.string().min(1, "Department is required"),
})

export async function getJobRoles(opts?: {
  departmentId?: string
  includeInactive?: boolean
}): Promise<ActionResult<JobRoleRow[]>> {
  return runAction(async () => {
    await requireSession()
    const where: Record<string, unknown> = {}
    if (!opts?.includeInactive) where.isActive = true
    if (opts?.departmentId) where.departmentId = opts.departmentId
    const data = await db.jobRole.findMany({
      where,
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: JOBROLE_SELECT,
    })
    return ok(data)
  })
}

export async function createJobRole(input: {
  name: string
  departmentId: string
}): Promise<ActionResult<JobRoleRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    try {
      const role = await db.jobRole.create({
        data: { name: parsed.data.name.trim(), departmentId: parsed.data.departmentId },
        select: JOBROLE_SELECT,
      })
      return ok(role)
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === "P2002") return fail("That role already exists in this department")
      if (code === "P2003") return fail("Department not found")
      throw e
    }
  })
}

export async function updateJobRole(
  id: string,
  body: { name?: string; departmentId?: string; isActive?: boolean },
): Promise<ActionResult<JobRoleRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const data: Record<string, string | boolean> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.departmentId !== undefined) data.departmentId = body.departmentId
    if (body.isActive !== undefined) data.isActive = !!body.isActive
    try {
      const role = await db.jobRole.update({ where: { id }, data, select: JOBROLE_SELECT })
      return ok(role)
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === "P2002") return fail("That role already exists in this department")
      throw e
    }
  })
}

/**
 * Soft-deactivate (isActive=false) by default, or hard-delete with permanent=true
 * (only when no employee references the role).
 */
export async function deleteJobRole(
  id: string,
  permanent = false,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const role = await db.jobRole.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    })
    if (!role) return fail("Job role not found")

    if (permanent) {
      if (role._count.employees > 0)
        return fail(
          `Cannot permanently delete: ${role._count.employees} employee(s) have this role. Deactivate instead.`,
        )
      await db.jobRole.delete({ where: { id } })
      return ok({ message: "Job role deleted permanently" })
    }

    await db.jobRole.update({ where: { id }, data: { isActive: false } })
    return ok({
      message: `Job role deactivated. ${role._count.employees} employee(s) still assigned.`,
    })
  })
}
