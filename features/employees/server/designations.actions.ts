"use server"

import { db } from "@/server/db"
import { z } from "zod"
import { PERMISSIONS } from "@/lib/constants"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"

const DESIG_SELECT = {
  id: true,
  title: true,
  level: true,
  isActive: true,
  _count: { select: { employees: true } },
} as const

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  level: z.number().int().min(1, "Level must be at least 1"),
})

type DesignationRow = {
  id: string
  title: string
  level: number
  isActive: boolean
  _count: { employees: number }
}

export async function getDesignations(opts?: {
  includeInactive?: boolean
}): Promise<ActionResult<DesignationRow[]>> {
  return runAction(async () => {
    await requireSession()
    const data = await db.designation.findMany({
      where: opts?.includeInactive ? {} : { isActive: true },
      orderBy: { level: "asc" },
      select: DESIG_SELECT,
    })
    return ok(data)
  })
}

export async function createDesignation(input: {
  title: string
  level: number
}): Promise<ActionResult<DesignationRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    try {
      const designation = await db.designation.create({
        data: { title: parsed.data.title, level: parsed.data.level },
        select: DESIG_SELECT,
      })
      return ok(designation)
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("Designation title already exists")
      throw e
    }
  })
}

export async function updateDesignation(
  id: string,
  body: { title?: string; level?: number; isActive?: boolean },
): Promise<ActionResult<DesignationRow>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const data: Record<string, string | number | boolean> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.level !== undefined) {
      const lvl = Number(body.level)
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 13)
        return fail("Level must be an integer between 1 and 13")
      data.level = lvl
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive
    try {
      const designation = await db.designation.update({ where: { id }, data, select: DESIG_SELECT })
      return ok(designation)
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("Designation title already exists")
      throw e
    }
  })
}

/**
 * Soft-deactivate (isActive=false) by default, or hard-delete with permanent=true
 * (only when no employee references the designation).
 */
export async function deleteDesignation(
  id: string,
  permanent = false,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const desig = await db.designation.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    })
    if (!desig) return fail("Designation not found")

    if (permanent) {
      if (desig._count.employees > 0)
        return fail(
          `Cannot permanently delete: ${desig._count.employees} employee(s) reference this designation. Deactivate instead.`,
        )
      await db.designation.delete({ where: { id } })
      return ok({ message: "Designation deleted permanently" })
    }

    await db.designation.update({ where: { id }, data: { isActive: false } })
    return ok({
      message: `Designation deactivated. ${desig._count.employees} employee(s) still assigned.`,
    })
  })
}
