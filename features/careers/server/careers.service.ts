import "server-only"

import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { slugifyCareer, type CareersTone } from "@/features/recruitment/careers-types"
import {
  createGroupSchema,
  updateGroupSchema,
  createSubDepartmentSchema,
  updateSubDepartmentSchema,
  createRoleSchema,
  updateRoleSchema,
  createOpeningSchema,
  updateOpeningSchema,
} from "@/features/careers/careers.schema"
import type {
  AdminCareerGroup,
  CareerDbMode,
  CareersDepartmentGroup,
} from "@/features/careers/careers.types"

function normalizeTone(value: string | null | undefined): CareersTone {
  return value === "red" || value === "teal" ? value : "teal"
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC read — no session (the route gates with X-API-Key). Returns only
// PUBLISHED rows for the given mode, ordered, in the marketing-site contract.
// ─────────────────────────────────────────────────────────────────────────────
export async function getPublishedCareers(mode: CareerDbMode): Promise<CareersDepartmentGroup[]> {
  const published = { status: "PUBLISHED" as const }
  const groups = await db.careerGroup.findMany({
    where: { mode, ...published },
    orderBy: { order: "asc" },
    include: {
      subDepartments: {
        where: published,
        orderBy: { order: "asc" },
        include: {
          roles: {
            where: published,
            orderBy: { order: "asc" },
            include: { openings: { where: published, orderBy: { order: "asc" } } },
          },
        },
      },
    },
  })

  return groups.map((g) => ({
    id: g.slug,
    code: g.code,
    title: g.title,
    jobsLabel: g.jobsLabel,
    tone: normalizeTone(g.tone),
    subDepartments: g.subDepartments.map((s) => ({
      id: s.slug,
      title: s.title,
      jobsLabel: s.jobsLabel,
      tone: normalizeTone(s.tone),
      roles: s.roles.map((r) => ({
        id: r.slug,
        title: r.title,
        meta: r.meta,
        summary: r.summary,
        description: r.intro
          ? {
              intro: r.intro,
              ...(r.jobEssence ? { jobEssence: r.jobEssence } : {}),
              keyRequirements: r.keyRequirements,
              currentOpenings: r.openings.map((o) => o.label),
            }
          : null,
      })),
    })),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN read — full tree (all statuses) for the management UI.
// ─────────────────────────────────────────────────────────────────────────────
export async function getCareersTree(): Promise<ActionResult<{ data: AdminCareerGroup[] }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_READ)
    const groups = await db.careerGroup.findMany({
      orderBy: [{ mode: "asc" }, { order: "asc" }],
      select: {
        id: true,
        mode: true,
        code: true,
        title: true,
        slug: true,
        jobsLabel: true,
        tone: true,
        order: true,
        status: true,
        subDepartments: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            slug: true,
            jobsLabel: true,
            tone: true,
            order: true,
            status: true,
            roles: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                slug: true,
                meta: true,
                summary: true,
                intro: true,
                jobEssence: true,
                keyRequirements: true,
                order: true,
                status: true,
                openings: {
                  orderBy: { order: "asc" },
                  select: { id: true, label: true, order: true, status: true },
                },
              },
            },
          },
        },
      },
    })
    return ok({ data: serialize(groups) as AdminCareerGroup[] })
  })
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function isUniqueError(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002"
}

// ─── Group CRUD ────────────────────────────────────────────────────────────────
export async function createGroup(input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = createGroupSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    const slug = p.data.slug || slugifyCareer(p.data.title)
    try {
      const row = await db.careerGroup.create({
        data: {
          mode: p.data.mode,
          code: p.data.code,
          title: p.data.title,
          slug,
          jobsLabel: p.data.jobsLabel,
          tone: p.data.tone,
          order: p.data.order ?? 0,
          status: p.data.status ?? "DRAFT",
        },
      })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e)) return fail("A group with this slug already exists for this mode")
      throw e
    }
  })
}

export async function updateGroup(id: string, input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = updateGroupSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    try {
      const row = await db.careerGroup.update({ where: { id }, data: p.data })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e)) return fail("A group with this slug already exists for this mode")
      throw e
    }
  })
}

export async function deleteGroup(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    await db.careerGroup.delete({ where: { id } })
    return ok({ message: "Group deleted" })
  })
}

// ─── SubDepartment CRUD ──────────────────────────────────────────────────────
export async function createSubDepartment(input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = createSubDepartmentSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    const slug = p.data.slug || slugifyCareer(p.data.title)
    try {
      const row = await db.careerSubDepartment.create({
        data: {
          groupId: p.data.groupId,
          title: p.data.title,
          slug,
          jobsLabel: p.data.jobsLabel,
          tone: p.data.tone,
          order: p.data.order ?? 0,
          status: p.data.status ?? "DRAFT",
        },
      })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e))
        return fail("A sub-department with this slug already exists in this group")
      throw e
    }
  })
}

export async function updateSubDepartment(
  id: string,
  input: unknown,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = updateSubDepartmentSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    try {
      const row = await db.careerSubDepartment.update({ where: { id }, data: p.data })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e))
        return fail("A sub-department with this slug already exists in this group")
      throw e
    }
  })
}

export async function deleteSubDepartment(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    await db.careerSubDepartment.delete({ where: { id } })
    return ok({ message: "Sub-department deleted" })
  })
}

// ─── Role CRUD ───────────────────────────────────────────────────────────────
export async function createRole(input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = createRoleSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    const slug = p.data.slug || slugifyCareer(p.data.title)
    try {
      const row = await db.careerRole.create({
        data: {
          subDepartmentId: p.data.subDepartmentId,
          title: p.data.title,
          slug,
          meta: p.data.meta ?? null,
          summary: p.data.summary ?? null,
          intro: p.data.intro ?? null,
          jobEssence: p.data.jobEssence ?? null,
          keyRequirements: p.data.keyRequirements ?? [],
          order: p.data.order ?? 0,
          status: p.data.status ?? "DRAFT",
        },
      })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e))
        return fail("A role with this slug already exists in this sub-department")
      throw e
    }
  })
}

export async function updateRole(id: string, input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = updateRoleSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    try {
      const row = await db.careerRole.update({ where: { id }, data: p.data })
      return ok(serialize({ data: row }))
    } catch (e) {
      if (isUniqueError(e))
        return fail("A role with this slug already exists in this sub-department")
      throw e
    }
  })
}

export async function deleteRole(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    await db.careerRole.delete({ where: { id } })
    return ok({ message: "Role deleted" })
  })
}

// ─── Opening CRUD ────────────────────────────────────────────────────────────
export async function createOpening(input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = createOpeningSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    const row = await db.careerOpening.create({
      data: {
        roleId: p.data.roleId,
        label: p.data.label,
        order: p.data.order ?? 0,
        status: p.data.status ?? "DRAFT",
      },
    })
    return ok(serialize({ data: row }))
  })
}

export async function updateOpening(id: string, input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    const p = updateOpeningSchema.safeParse(input)
    if (!p.success) return fail("Invalid input", p.error.flatten().fieldErrors)
    const row = await db.careerOpening.update({ where: { id }, data: p.data })
    return ok(serialize({ data: row }))
  })
}

export async function deleteOpening(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.RECRUITMENT_WRITE)
    await db.careerOpening.delete({ where: { id } })
    return ok({ message: "Opening deleted" })
  })
}
