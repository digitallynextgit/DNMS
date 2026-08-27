import "server-only"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { isValidSlug, slugRejectionReason } from "@/server/tenants"
import { normalizeEmail, provisionIdentity } from "@/server/identity"
import { ROLE_CATALOGUE, FOUNDER_ROLE } from "@/lib/role-catalogue"
import { generateEmployeeNo } from "@/lib/utils"

// =============================================================================
// Provisioning a new company (M5).
//
// The moment a second tenant exists, everything M1-M4 built stops being
// theoretical. This is the function that creates one.
//
// ── WHAT A USABLE TENANT NEEDS ───────────────────────────────────────────────
// Not just a `tenants` row. A company whose first admin signs in to an app where
// nothing works has not been onboarded, so provisioning also creates:
//
//   - the five ROLES with their permission grants. Roles are tenant-scoped, so a
//     new company gets its own editable copy; the 39 permission SCOPES are
//     platform-level and shared, because a scope describes what the software can
//     do, not what a customer bought.
//   - default LEAVE TYPES, or the leave module has nothing to offer.
//   - the founding EMPLOYEE, their platform identity, and their membership.
//
// Departments, designations and holidays are deliberately NOT seeded: they are
// specific to each company, and a list of somebody else's departments is worse
// than an empty one.
//
// ── ALL OR NOTHING ───────────────────────────────────────────────────────────
// One transaction. A half-provisioned tenant - a company with no admin, or an
// admin with no roles - is worse than a failed signup, because it looks like it
// worked and locks somebody out of an account they believe they created.
// =============================================================================

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
  /** Display name, e.g. "Acme Media". */
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

/**
 * Create a company, its roles, its defaults and its first admin.
 *
 * Runs UNSCOPED: it is creating the tenant it would otherwise be scoped to, and
 * the uniqueness checks below have to see every tenant, not one.
 */
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

    // The catalogue's scopes, resolved once. Permissions are platform-level, so
    // they already exist - a tenant links to them, it does not create them.
    const permissions = await db.permission.findMany({ select: { id: true, scope: true } })
    if (permissions.length === 0) {
      throw new ProvisionError(
        "The permission catalogue is empty - run prisma/sync-permissions.ts before provisioning.",
      )
    }
    const permissionIdByScope = new Map(permissions.map((p) => [p.scope, p.id]))

    const passwordHash = await bcrypt.hash(input.adminPassword, 12)

    const created = await db.$transaction(async (tx) => {
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

      // ── roles + grants ────────────────────────────────────────────────────
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

      // ── leave types ───────────────────────────────────────────────────────
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

      // ── the founding admin ────────────────────────────────────────────────
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
    })

    // Identity last, and OUTSIDE the transaction on purpose: provisionIdentity
    // upserts a platform-level `users` row that may already exist (this person
    // could already work at another company on the platform), and it is
    // idempotent, so re-running it is safe in a way that rolling it back is not.
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
 * Remove a tenant and everything in it. For undoing a test signup.
 *
 * Almost every tenant-scoped table cascades from its own parents, but not from
 * `tenants` - that foreign key is ON DELETE RESTRICT precisely so a customer
 * cannot be erased by accident. So the rows are deleted explicitly and the
 * tenant row last.
 *
 * ── WHY THE TABLE LIST IS DISCOVERED, NOT WRITTEN DOWN ───────────────────────
 * This began as a hand-written list of the seven tables PROVISIONING creates,
 * which is all a freshly-made-and-immediately-removed test tenant ever has. A
 * tenant somebody actually signed into has more: the first real trial signup
 * left audit_logs and push_subscriptions behind, still carrying the id of a
 * tenant that no longer existed. Rows like that are unreachable by any session
 * and invisible to the guard - exactly the corruption verify-tenancy.ts checks
 * for.
 *
 * So the tables come from Prisma's runtime model list: every model with a
 * tenantId, no exceptions, discovered fresh each run. A model added next year is
 * covered without anyone remembering this function exists.
 *
 * ORDER is resolved by retrying rather than by encoding the dependency graph.
 * Deleting a table whose rows are still referenced raises a foreign-key error;
 * that table is simply retried on the next pass, once whatever pointed at it has
 * gone. It converges in a handful of passes and cannot go stale the way a
 * hand-sorted list does.
 *
 * Refuses to touch the founding tenant.
 */
export async function deprovisionTenant(slug: string): Promise<{ deleted: number }> {
  return runUnscoped("deprovision: removing a tenant is by definition cross-tenant", async () => {
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true, slug: true } })
    if (!tenant) throw new ProvisionError(`No tenant "${slug}".`)
    const { FOUNDING_TENANT_ID } = await import("@/server/tenant-context")
    if (tenant.id === FOUNDING_TENANT_ID) {
      throw new ProvisionError("Refusing to delete the founding tenant.")
    }

    // Every model carrying a tenantId, from the runtime datamodel.
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

    // Counted BEFORE anything is removed. Summing what deleteMany reports
    // under-counts badly: deleting `roles` cascades to `role_permissions`, so by
    // the time the sweep reaches that table its rows are already gone and it
    // reports 0. The first real run returned "14" for a tenant that held 159
    // rows - accurate deletion, useless number.
    let deleted = 0
    for (const name of remaining) {
      deleted += await client[name]!.count({ where: { tenantId: tenant.id } })
    }

    // Each pass removes whatever no longer has anything pointing at it. Bounded
    // so a genuine cycle fails loudly instead of spinning.
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
