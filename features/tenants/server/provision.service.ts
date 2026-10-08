import "server-only"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { isValidSlug, slugRejectionReason } from "@/server/tenants"
import { normalizeEmail, provisionIdentity } from "@/server/identity"
import { ROLE_CATALOGUE, FOUNDER_ROLE } from "@/lib/role-catalogue"
import { seedChecklistTemplates } from "@/features/hr-checklists/lib/seed-templates"
import { generateEmployeeNo } from "@/lib/utils"

// Provisions a new company in ONE transaction - a half-made tenant (no admin, or an admin with
// no roles) is worse than a failed signup. Creates the five roles + grants (permission scopes
// are platform-level and shared), default leave types, onboarding/exit checklist templates and
// the founding employee. Departments, designations and holidays are left to the company.

/** Leave types a new company starts with. Editable from day one. */
const DEFAULT_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", isPaid: true, maxDaysPerYear: 7 },
  { name: "Sick Leave", code: "SL", isPaid: true, maxDaysPerYear: 7 },
  {
    name: "Earned Leave",
    code: "EL",
    isPaid: true,
    maxDaysPerYear: 14,
    carryForward: true,
    maxCarryDays: 22,
  },
  { name: "Leave Without Pay", code: "LWP", isPaid: false, maxDaysPerYear: 0 },
] as const

/** How long a trial runs. Matches the "3 weeks" the plan is sold on. */
export const TRIAL_DAYS = 21

export interface ProvisionInput {
  companyName: string
  /** URL segment, e.g. "acme-media". Validated against RESERVED_SLUGS. */
  slug: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPassword: string
  plan?: "TRIAL" | "STARTER" | "RED" | "ENTERPRISE"
}

export interface ProvisionResult {
  tenantId: string
  slug: string
  employeeId: string
  userId: string
}

export class ProvisionError extends Error {
  constructor(
    message: string,
    readonly field?: keyof ProvisionInput,
  ) {
    super(message)
    this.name = "ProvisionError"
  }
}

/** Create a company, its roles, defaults and first admin. Runs unscoped: the uniqueness
 *  checks must see every tenant. */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const slug = input.slug.trim().toLowerCase()
  const email = normalizeEmail(input.adminEmail)
  const companyName = input.companyName.trim()

  if (companyName.length < 2) throw new ProvisionError("Enter your company name.", "companyName")
  if (!isValidSlug(slug)) {
    throw new ProvisionError(
      slugRejectionReason(slug) ?? "That workspace name cannot be used.",
      "slug",
    )
  }
  if (!email.includes("@")) throw new ProvisionError("Enter a valid email address.", "adminEmail")
  if (input.adminPassword.length < 8) {
    throw new ProvisionError("Password must be at least 8 characters.", "adminPassword")
  }

  return runUnscoped("signup: creating the tenant this work would be scoped to", async () => {
    if (await db.tenant.findUnique({ where: { slug }, select: { id: true } })) {
      throw new ProvisionError("That workspace name is taken.", "slug")
    }

    // Permission scopes are platform-level, so a tenant links to them rather than creating them.
    const permissions = await db.permission.findMany({ select: { id: true, scope: true } })
    if (permissions.length === 0) {
      throw new ProvisionError(
        "The permission catalogue is empty - run prisma/sync-permissions.ts before provisioning.",
      )
    }
    const permissionIdByScope = new Map(permissions.map((p) => [p.scope, p.id]))

    const passwordHash = await bcrypt.hash(input.adminPassword, 12)

    const created = await db.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug,
            name: companyName,
            status: "ACTIVE",
            plan: input.plan ?? "TRIAL",
            trialEndsAt:
              (input.plan ?? "TRIAL") === "TRIAL"
                ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
                : null,
          },
          select: { id: true, slug: true },
        })

        const roleIdByName = new Map<string, string>()
        for (const definition of ROLE_CATALOGUE) {
          const role = await tx.role.create({
            data: {
              tenantId: tenant.id,
              name: definition.name,
              displayName: definition.displayName,
              description: definition.description,
              isSystem: definition.isSystem,
            },
            select: { id: true },
          })
          roleIdByName.set(definition.name, role.id)

          const scopes =
            definition.permissions === "ALL"
              ? permissions.map((p) => p.scope)
              : [...definition.permissions]
          const grants = scopes
            .map((scope) => permissionIdByScope.get(scope))
            .filter((id): id is string => Boolean(id))
            .map((permissionId) => ({ tenantId: tenant.id, roleId: role.id, permissionId }))
          if (grants.length > 0) await tx.rolePermission.createMany({ data: grants })
        }

        await tx.leaveType.createMany({
          data: DEFAULT_LEAVE_TYPES.map((t) => ({
            tenantId: tenant.id,
            name: t.name,
            code: t.code,
            isPaid: t.isPaid,
            maxDaysPerYear: t.maxDaysPerYear,
            carryForward: "carryForward" in t ? t.carryForward : false,
            maxCarryDays: "maxCarryDays" in t ? t.maxCarryDays : 0,
          })),
        })

        await seedChecklistTemplates(tx, tenant.id)

        const employee = await tx.employee.create({
          data: {
            tenantId: tenant.id,
            employeeNo: generateEmployeeNo(1),
            firstName: input.adminFirstName.trim() || "Admin",
            lastName: input.adminLastName.trim(),
            email,
            passwordHash,
            // They chose this password themselves at signup - do not force a change.
            mustChangePassword: false,
            isActive: true,
            status: "ACTIVE",
            onProbation: false,
            dateOfJoining: new Date(),
          },
          select: { id: true },
        })

        const founderRoleId = roleIdByName.get(FOUNDER_ROLE)
        if (!founderRoleId) throw new ProvisionError("Role catalogue is missing the admin role.")
        await tx.employeeRole.create({
          data: { tenantId: tenant.id, employeeId: employee.id, roleId: founderRoleId },
        })

        return { tenant, employeeId: employee.id }
        // ~60 sequential inserts; Prisma's 5s default is too tight over a slow DB link.
      },
      { timeout: 30_000, maxWait: 10_000 },
    )

    // Identity last and outside the transaction: the platform `users` row may already exist
    // (another company), and the idempotent upsert is safe to re-run but not to roll back.
    const { userId } = await provisionIdentity({
      email,
      name: `${input.adminFirstName} ${input.adminLastName}`.trim(),
      tenantId: created.tenant.id,
      kind: "STAFF",
      employeeId: created.employeeId,
      passwordHash,
      mustChangePassword: false,
    })

    return {
      tenantId: created.tenant.id,
      slug: created.tenant.slug,
      employeeId: created.employeeId,
      userId,
    }
  })
}

/**
 * Remove a tenant and everything in it (for undoing a test signup). The tenant FK is ON DELETE
 * RESTRICT, so every model with a tenantId (found at runtime, so new models are covered) is
 * deleted explicitly, retrying FK-blocked tables on later passes. Refuses the founding tenant.
 */
export async function deprovisionTenant(slug: string): Promise<{ deleted: number }> {
  return runUnscoped("deprovision: removing a tenant is by definition cross-tenant", async () => {
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true, slug: true } })
    if (!tenant) throw new ProvisionError(`No tenant "${slug}".`)
    const { FOUNDING_TENANT_ID } = await import("@/server/tenant-context")
    if (tenant.id === FOUNDING_TENANT_ID) {
      throw new ProvisionError("Refusing to delete the founding tenant.")
    }

    const scoped = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === "tenantId"))
      .map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1))
      .filter((d) => d !== "tenant") // the parent row goes last, on its own

    type Deleter = {
      deleteMany: (a: unknown) => Promise<{ count: number }>
      count: (a: unknown) => Promise<number>
    }
    const client = db as unknown as Record<string, Deleter | undefined>

    let remaining = scoped.filter((d) => typeof client[d]?.deleteMany === "function")

    // Counted up front: deleteMany under-counts rows already removed by cascades.
    let deleted = 0
    for (const name of remaining) {
      deleted += await client[name]!.count({ where: { tenantId: tenant.id } })
    }

    // Each pass removes what nothing references any more; bounded so a real cycle fails loudly.
    for (let pass = 0; pass < 12 && remaining.length > 0; pass++) {
      const blocked: string[] = []
      for (const name of remaining) {
        try {
          await client[name]!.deleteMany({ where: { tenantId: tenant.id } })
        } catch {
          blocked.push(name) // still referenced - try again next pass
        }
      }
      if (blocked.length === remaining.length) {
        throw new ProvisionError(
          `Could not delete tenant "${slug}": ${blocked.join(", ")} still referenced.`,
        )
      }
      remaining = blocked
    }

    await db.tenant.deleteMany({ where: { id: tenant.id } })

    return { deleted: deleted + 1 } // + the tenant row itself
  })
}
