import "server-only"

import { db } from "@/server/db"
import { provisionIdentity, setMembershipActive, syncIdentityProfile } from "@/server/identity"
import { checkTenantHeadcount } from "@/features/tenants/server/plan-limits"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeFilterSchema,
} from "@/features/employees/schemas/employee.schema"
import { generateEmployeeNo, employeeSlug } from "@/lib/utils"
import { addEmailJob } from "@/lib/queue"
import { createNotifications } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import { getConfig } from "@/server/app-config"
import { canAccessEmployee } from "@/lib/permissions"
// Server-only import (not the barrel): seeds leave balances for a new hire.
import { allocateFromPolicy } from "@/features/leave/server/leave-accrual.service"
import { instantiateAndNotify } from "@/features/hr-checklists/server/checklists.service"
import { startScorecardFor } from "@/features/joinee-scorecard/server/scorecard.service"
import { encrypt } from "@/lib/crypto"
import bcrypt from "bcryptjs"
import { randomInt } from "crypto"
import { departmentDescendantIds } from "../lib/department-tree"

// Readable initial password for a new hire (no ambiguous 0/O, 1/l/I).
function generateInitialPassword(length = 12): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%"
  let out = ""
  for (let i = 0; i < length; i++) out += charset[randomInt(charset.length)]
  return out
}

import type { OrgNode } from "@/types"
import { renderWelcomeCredentialsEmail } from "@/features/employees/emails/welcome-credentials"
import { requireSession, requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT, EMPLOYEE_LIST_SELECT } from "@/server/selects"

type EmployeeFilters = {
  search?: string
  departmentId?: string
  designationId?: string
  status?: string
  employmentType?: string
  page?: number
  limit?: number
}

// Every email must be unique across all employees' work AND personal emails (case-insensitive).
// Returns a user-facing error, or null when free.
async function checkEmailUniqueness(
  email: string,
  personalEmail: string | null | undefined,
  excludeId?: string,
): Promise<string | null> {
  const work = email.trim().toLowerCase()
  const personal = personalEmail?.trim().toLowerCase() || null

  // One employee may use the same address for both (e.g. interns with one inbox).
  const candidates = personal && personal !== work ? [work, personal] : [work]
  const or = candidates.flatMap((value) => [
    { email: { equals: value, mode: "insensitive" as const } },
    { personalEmail: { equals: value, mode: "insensitive" as const } },
  ])

  const clash = await db.employee.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: or,
    },
    select: { email: true, personalEmail: true },
  })
  if (!clash) return null

  const clashWork = clash.email.toLowerCase()
  const clashPersonal = clash.personalEmail?.toLowerCase() || null
  if (clashWork === work || clashPersonal === work)
    return "This work email is already used by another employee"
  return "This personal email is already used by another employee"
}

export async function getEmployees(filters: EmployeeFilters = {}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const parsed = employeeFilterSchema.safeParse({
      search: filters.search || undefined,
      departmentId: filters.departmentId || undefined,
      designationId: filters.designationId || undefined,
      status: filters.status || undefined,
      employmentType: filters.employmentType || undefined,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    })
    if (!parsed.success) return fail("Invalid query parameters", parsed.error.flatten().fieldErrors)

    const { search, departmentId, designationId, status } = parsed.data
    const { page, limit, skip, take } = resolvePagination(parsed.data, 20)

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeNo: { contains: search, mode: "insensitive" } },
      ]
    }
    if (departmentId) {
      // A department includes its sub-departments.
      const tree = await db.department.findMany({ select: { id: true, parentId: true } })
      where.departmentId = { in: [departmentId, ...departmentDescendantIds(tree, departmentId)] }
    }
    if (designationId) where.designationId = designationId
    // Active/Inactive follow isActive (deactivation leaves status ACTIVE).
    if (status === "ACTIVE") where.isActive = true
    else if (status === "INACTIVE") where.isActive = false
    else if (status) where.status = status
    // Admin_ is a hidden watch account - never list it in the directory.
    where.NOT = { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        select: EMPLOYEE_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.employee.count({ where }),
    ])

    return ok(
      serialize({
        data: employees,
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

/** Readable list of changed field names ("dateOfJoining" -> "Date of joining"), capped at max. */
function humanFieldList(fields: string[], max = 4): string {
  const LABELS: Record<string, string> = {
    employeeNo: "Employee code",
    deviceId: "Biometric code",
    firstName: "First name",
    lastName: "Last name",
    email: "Work email",
    personalEmail: "Personal email",
    phone: "Phone",
    personalPhone: "Personal phone",
    dateOfBirth: "Date of birth",
    departmentId: "Department",
    designationId: "Designation",
    jobRoleId: "Job role",
    managerId: "Reporting manager",
    dottedManagerId: "Dotted-line manager",
    employmentType: "Employment type",
    status: "Status",
    dateOfJoining: "Date of joining",
    probationEndDate: "Probation end date",
    confirmationDate: "Confirmation date",
    probationMonths: "Probation months",
    workLocation: "Work location",
  }
  const pretty = fields.map(
    (f) => LABELS[f] ?? f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
  )
  const shown = pretty.slice(0, max)
  const rest = pretty.length - shown.length
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ")
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resolve a UUID or a "<code>-<name>" slug (e.g. "8-diwakar-jha") to an id. Codes can contain
// dashes (EMP-2026-0001), so every leading dash-prefix is tried.
async function resolveEmployeeId(idOrSlug: string): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug
  const segs = idOrSlug.split("-")
  const prefixes: string[] = []
  for (let i = 1; i <= segs.length; i++) prefixes.push(segs.slice(0, i).join("-"))
  const match = await db.employee.findFirst({
    where: { employeeNo: { in: prefixes } },
    select: { id: true },
  })
  return match?.id ?? null
}

export async function getEmployee(idOrSlug: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const id = await resolveEmployeeId(idOrSlug)
    if (!id) return fail("Employee not found")
    if (!canAccessEmployee(session, id)) return fail("Forbidden")

    const employee = await db.employee.findUnique({
      where: { id },
      // Opt gmailAppPassword back in only to derive a boolean; the ciphertext is stripped below.
      omit: { gmailAppPassword: false },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, title: true, level: true } },
        jobRole: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true, profilePhoto: true },
        },
        _count: { select: { subordinates: true, documents: true } },
        employeeRoles: {
          include: { role: { select: { id: true, name: true, displayName: true } } },
        },
      },
    })
    if (!employee) return fail("Employee not found")
    // Never send the App Password ciphertext to the client - only a boolean.
    const { gmailAppPassword, ...rest } = employee
    return ok(serialize({ data: { ...rest, hasGmailAppPassword: !!gmailAppPassword } }))
  })
}

// Every employee code, so the create form can show taken codes and pre-fill the next free one.
export async function getEmployeeCodes(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const employees = await db.employee.findMany({
      where: { NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } } },
      orderBy: { employeeNo: "asc" },
      select: EMPLOYEE_SUMMARY_SELECT,
    })
    return ok(serialize({ data: employees }))
  })
}

// Live duplicate check for one email (against all work and personal emails); `excludeId`
// skips the employee being edited.
export async function checkEmailAvailability(
  email: string,
  excludeId?: string,
): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const value = email.trim().toLowerCase()
    if (!value) return ok({ available: true })

    const clash = await db.employee.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { email: { equals: value, mode: "insensitive" } },
          { personalEmail: { equals: value, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })
    return ok({ available: !clash })
  })
}

export async function createEmployee(input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = createEmployeeSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const data = parsed.data

    try {
      // Use the provided code (must be unique); auto-generate only when blank.
      const providedNo = data.employeeNo?.trim()
      if (providedNo) {
        const existing = await db.employee.findFirst({
          where: { employeeNo: providedNo },
          select: { id: true },
        })
        if (existing) return fail("An employee with this code already exists")
      }

      const emailError = await checkEmailUniqueness(data.email, data.personalEmail)
      if (emailError) return fail(emailError)

      // Plan headcount limit - checked here because every create path (form, import, API) ends here
      const planCheck = await checkTenantHeadcount()
      if (!planCheck.allowed)
        return fail(planCheck.message ?? "Employee limit reached", undefined, 402)

      const totalCount = await db.employee.count()
      const employeeNo = providedNo || generateEmployeeNo(totalCount + 1)

      // Generate a password when none is given, so the new hire can be emailed credentials.
      const plainPassword = data.password || generateInitialPassword()
      const passwordHash = await bcrypt.hash(plainPassword, 12)
      const gmailAppPassword = data.gmailAppPassword ? encrypt(data.gmailAppPassword) : null

      const currentAddress = data.currentAddress
        ? JSON.parse(JSON.stringify(data.currentAddress))
        : undefined
      const permanentAddress = data.permanentAddress
        ? JSON.parse(JSON.stringify(data.permanentAddress))
        : undefined
      const emergencyContact = data.emergencyContact
        ? JSON.parse(JSON.stringify(data.emergencyContact))
        : undefined

      const employee = await db.employee.create({
        data: {
          employeeNo,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          personalEmail: data.personalEmail || null,
          phone: data.phone || null,
          personalPhone: data.personalPhone || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || null,
          nationality: data.nationality || null,
          bloodGroup: data.bloodGroup || null,
          departmentId: data.departmentId || null,
          designationId: data.designationId || null,
          jobRoleId: data.jobRoleId || null,
          managerId: data.managerId || null,
          dottedManagerId: data.dottedManagerId || null,
          employmentType: data.employmentType,
          dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : null,
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          // DB defaults: onProbation=true, probationMonths=6.
          ...(data.onProbation !== undefined ? { onProbation: data.onProbation } : {}),
          ...(data.probationMonths !== undefined ? { probationMonths: data.probationMonths } : {}),
          deviceId: data.deviceId || null,
          workLocation: data.workLocation || null,
          currentAddress,
          permanentAddress,
          emergencyContact,
          passwordHash,
          mustChangePassword: data.mustChangePassword ?? false,
          gmailAppPassword,
        },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
        },
      })

      // A platform identity is needed to sign in, so a failure here fails the creation. An address
      // already on the platform keeps its credential and just gains a STAFF membership.
      await provisionIdentity({
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        tenantId: employee.tenantId,
        kind: "STAFF",
        employeeId: employee.id,
        passwordHash,
        mustChangePassword: data.mustChangePassword ?? false,
      })

      let roleToAssign: { id: string } | null = null
      if (data.roleId) {
        const candidate = await db.role.findUnique({
          where: { id: data.roleId },
          select: { id: true, name: true },
        })
        if (candidate && !HIDDEN_ROLES.includes(candidate.name as (typeof HIDDEN_ROLES)[number])) {
          roleToAssign = { id: candidate.id }
        }
      }
      if (!roleToAssign) {
        roleToAssign = await db.role.findFirst({
          where: { name: "employee" },
          select: { id: true },
        })
      }
      if (roleToAssign) {
        await db.employeeRole.create({
          data: { employeeId: employee.id, roleId: roleToAssign.id },
        })
      }

      // Seed this year's leave balances (pro-rated by join date). Best-effort.
      try {
        await allocateFromPolicy(employee.id, new Date().getFullYear())
      } catch (e) {
        console.error("[createEmployee] leave allocation failed", e)
      }

      // Onboarding checklist from the tenant template. Best-effort: HR can start one by hand.
      try {
        await instantiateAndNotify({
          employeeId: employee.id,
          kind: "ONBOARDING",
          actorId: session.user.id,
        })
      } catch (e) {
        console.error("[createEmployee] onboarding checklist failed", e)
      }

      // 15-day joinee scorecard (one row per working day). Best-effort.
      try {
        await startScorecardFor(employee.id, { actorId: session.user.id })
      } catch (e) {
        console.error("[createEmployee] joinee scorecard failed", e)
      }

      const meta = await getAuditMeta()
      await createAuditLog(session, {
        action: "CREATE",
        module: "employee",
        entityType: "Employee",
        entityId: employee.id,
        changes: { created: { employeeNo, email: data.email } },
        ...meta,
      })

      // Tell HR + admins about the new hire (never the person who created them).
      try {
        const staff = await db.employee.findMany({
          where: {
            isActive: true,
            status: "ACTIVE",
            id: { not: session.user.id },
            employeeRoles: { some: { role: { name: { in: ["hr_manager", "admin"] } } } },
          },
          select: { id: true },
        })
        if (staff.length > 0) {
          const fullName = `${employee.firstName} ${employee.lastName}`.trim()
          const where = [employee.designation?.title, employee.department?.name]
            .filter(Boolean)
            .join(", ")
          await createNotifications(
            staff.map((s) => ({
              employeeId: s.id,
              title: "New employee onboarded",
              message: `${fullName} (${employee.employeeNo}) was added${where ? ` as ${where}` : ""}.`,
              type: "info" as const,
              link: `/employees/${employeeSlug(employee.employeeNo, employee.firstName, employee.lastName)}`,
            })),
          )
        }
      } catch (e) {
        // A notification failure must never cost us the created employee.
        console.error("[createEmployee] HR notification failed", e)
      }

      // One welcome + credentials email to the work and personal addresses.
      const recipients = [employee.email, employee.personalEmail].filter(Boolean).join(", ")
      if (recipients) {
        const appUrl = (await getConfig("APP_URL")) ?? "http://localhost:3000"
        const loginUrl = `${appUrl}/login`
        const { subject, html, text } = renderWelcomeCredentialsEmail({
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          employeeNo: employee.employeeNo,
          department: employee.department?.name ?? null,
          designation: employee.designation?.title ?? null,
          password: plainPassword,
          mustChange: employee.mustChangePassword,
          loginUrl,
        })
        await addEmailJob({ to: recipients, subject, html, text, profile: "notifications" })
      }

      return ok(serialize({ data: employee }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("An employee with this email already exists")
      throw e
    }
  })
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const parsed = updateEmployeeSchema.safeParse(input)
    if (!parsed.success) return fail("Validation failed", parsed.error.flatten().fieldErrors)
    const data = parsed.data

    const before = await db.employee.findUnique({ where: { id } })
    if (!before) return fail("Employee not found")

    // Re-check uniqueness when either email changes (the other falls back to the stored value).
    if (data.email !== undefined || data.personalEmail !== undefined) {
      const nextEmail = data.email !== undefined ? data.email : before.email
      const nextPersonal =
        data.personalEmail !== undefined ? data.personalEmail || null : before.personalEmail
      const emailError = await checkEmailUniqueness(nextEmail, nextPersonal, id)
      if (emailError) return fail(emailError)
    }

    const updateData: Record<string, unknown> = {}
    if (data.employeeNo !== undefined) {
      const nextNo = data.employeeNo.trim()
      if (nextNo && nextNo !== before.employeeNo) {
        const dupe = await db.employee.findFirst({
          where: { employeeNo: nextNo },
          select: { id: true },
        })
        if (dupe) return fail("An employee with this code already exists")
        updateData.employeeNo = nextNo
      }
    }
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email
    if (data.personalEmail !== undefined) updateData.personalEmail = data.personalEmail || null
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.personalPhone !== undefined) updateData.personalPhone = data.personalPhone || null
    if (data.dateOfBirth !== undefined)
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
    if (data.gender !== undefined) updateData.gender = data.gender || null
    if (data.nationality !== undefined) updateData.nationality = data.nationality || null
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null
    if (data.designationId !== undefined) updateData.designationId = data.designationId || null
    if (data.jobRoleId !== undefined) updateData.jobRoleId = data.jobRoleId || null
    if (data.managerId !== undefined) updateData.managerId = data.managerId || null
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType
    if (data.dateOfJoining !== undefined)
      updateData.dateOfJoining = data.dateOfJoining ? new Date(data.dateOfJoining) : null
    if (data.probationEndDate !== undefined)
      updateData.probationEndDate = data.probationEndDate ? new Date(data.probationEndDate) : null
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation || null
    if (data.deviceId !== undefined) updateData.deviceId = data.deviceId || null
    if (data.onProbation !== undefined) updateData.onProbation = data.onProbation
    if (data.probationMonths !== undefined) updateData.probationMonths = data.probationMonths
    // Confirming probation early records the date, so leave accrues from then.
    if (data.onProbation === false && before.onProbation && !before.confirmationDate) {
      updateData.confirmationDate = new Date()
    }
    // Blank App Password = keep the existing one.
    if (data.gmailAppPassword) updateData.gmailAppPassword = encrypt(data.gmailAppPassword)
    if (data.currentAddress !== undefined)
      updateData.currentAddress = data.currentAddress
        ? JSON.parse(JSON.stringify(data.currentAddress))
        : null
    if (data.permanentAddress !== undefined)
      updateData.permanentAddress = data.permanentAddress
        ? JSON.parse(JSON.stringify(data.permanentAddress))
        : null
    if (data.emergencyContact !== undefined)
      updateData.emergencyContact = data.emergencyContact
        ? JSON.parse(JSON.stringify(data.emergencyContact))
        : null

    try {
      const employee = await db.employee.update({
        where: { id },
        data: updateData,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      // Keep the platform identity in step: users.email is what login matches against.
      if (data.email !== undefined || data.firstName !== undefined || data.lastName !== undefined) {
        await syncIdentityProfile(
          { employeeId: id },
          {
            ...(data.email !== undefined ? { email: employee.email } : {}),
            ...(data.firstName !== undefined || data.lastName !== undefined
              ? { name: `${employee.firstName} ${employee.lastName}` }
              : {}),
          },
        )
      }

      // Recompute this year's balances when accrual inputs change (best-effort).
      if (
        [
          "onProbation",
          "probationMonths",
          "dateOfJoining",
          "employmentType",
          "confirmationDate",
        ].some((k) => k in updateData)
      ) {
        try {
          await allocateFromPolicy(id, new Date().getFullYear())
        } catch (e) {
          console.error("[updateEmployee] leave re-allocation failed", e)
        }
      }

      const changedFields: Record<string, { before: unknown; after: unknown }> = {}
      for (const key of Object.keys(updateData)) {
        const beforeVal = (before as Record<string, unknown>)[key]
        const afterVal = updateData[key]
        if (String(beforeVal) !== String(afterVal))
          changedFields[key] = { before: beforeVal, after: afterVal }
      }

      const meta = await getAuditMeta()
      await createAuditLog(session, {
        action: "UPDATE",
        module: "employee",
        entityType: "Employee",
        entityId: id,
        changes: changedFields,
        ...meta,
      })

      // Tell the employee their profile was edited (skipped if nothing changed or it was them).
      const fieldNames = Object.keys(changedFields)
      if (fieldNames.length > 0 && id !== session.user.id) {
        try {
          await createNotifications([
            {
              employeeId: id,
              title: "Your profile was updated",
              message: `${humanFieldList(fieldNames)} ${
                fieldNames.length === 1 ? "was" : "were"
              } changed by HR. Please check it's correct.`,
              type: "info",
              link: `/employees/${employeeSlug(employee.employeeNo, employee.firstName, employee.lastName)}`,
            },
          ])
        } catch (e) {
          console.error("[updateEmployee] notification failed", e)
        }
      }

      return ok(serialize({ data: employee }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("Email already in use by another employee")
      throw e
    }
  })
}

export async function deactivateEmployee(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_DELETE)
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return fail("Employee not found")
    if (id === session.user.id) return fail("You can't deactivate your own account")

    await db.employee.update({ where: { id }, data: { isActive: false } })
    // Mirror onto the membership (login already checks employee.isActive).
    await setMembershipActive({ employeeId: id }, false)
    // Leavers drop their team seats and team leadership; tasks and deliverables keep pointing
    // at them as history.
    const [seats, teamsRun] = await db.$transaction([
      db.projectTeamMember.deleteMany({ where: { employeeId: id } }),
      db.projectTeam.updateMany({ where: { managerId: id }, data: { managerId: null } }),
      db.projectServiceOwner.deleteMany({ where: { employeeId: id } }),
    ])
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "DEACTIVATE",
      module: "employee",
      entityType: "Employee",
      entityId: id,
      changes: {
        previousIsActive: existing.isActive,
        previousStatus: existing.status,
        teamSeatsRemoved: seats.count,
        teamsLeftWithoutManager: teamsRun.count,
      },
      ...meta,
    })
    const notes = [
      seats.count ? `removed from ${seats.count} team${seats.count === 1 ? "" : "s"}` : "",
      teamsRun.count
        ? `${teamsRun.count} team${teamsRun.count === 1 ? " needs" : "s need"} a new manager`
        : "",
    ].filter(Boolean)
    return ok({ message: ["Employee deactivated", ...notes].join(" · ") })
  })
}

export async function deleteEmployeePermanent(
  id: string,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_DELETE)
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return fail("Employee not found")
    if (id === session.user.id) return fail("You can't deactivate your own account")
    if (existing.isActive) return fail("Deactivate the employee before deleting permanently")

    await db.employee.delete({ where: { id } })
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "HARD_DELETE",
      module: "employee",
      entityType: "Employee",
      entityId: id,
      changes: {
        employeeNo: existing.employeeNo,
        email: existing.email,
        previousStatus: existing.status,
      },
      ...meta,
    })
    return ok({ message: "Employee deleted permanently" })
  })
}

export async function activateEmployee(id: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return fail("Employee not found")

    const employee = await db.employee.update({
      where: { id },
      data: { isActive: true, status: "ACTIVE" },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    })
    await setMembershipActive({ employeeId: id }, true)
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "ACTIVATE",
      module: "employee",
      entityType: "Employee",
      entityId: id,
      changes: { previousStatus: existing.status, previousIsActive: existing.isActive },
      ...meta,
    })
    return ok(serialize({ data: employee }))
  })
}

export async function bulkTerminateEmployees(
  ids: string[],
): Promise<ActionResult<{ data: { count: number } }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_DELETE)
    const list = Array.isArray(ids) ? ids : []
    if (list.length === 0) return fail("ids array is required")

    const targets = list.filter((id) => id !== session.user.id)
    if (targets.length === 0) return fail("Nothing to terminate")

    const result = await db.employee.updateMany({
      where: { id: { in: targets } },
      data: { status: "TERMINATED", isActive: false, lastWorkingDate: new Date() },
    })
    await db.membership.updateMany({
      where: { employeeId: { in: targets } },
      data: { isActive: false },
    })
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "BULK_TERMINATE",
      module: "employee",
      entityType: "Employee",
      changes: { count: result.count, employeeIds: targets },
      ...meta,
    })
    return ok({ data: { count: result.count } })
  })
}

function buildOrgTree(
  employees: Array<{
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    managerId: string | null
    designation: { title: string } | null
    department: { name: string } | null
    profilePhoto: string | null
    employeeRoles: Array<{ role: { name: string; displayName: string | null } }>
  }>,
  managerId: string | null,
): OrgNode[] {
  return employees
    .filter((e) => e.managerId === managerId)
    .map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      employeeNo: e.employeeNo,
      designation: e.designation,
      department: e.department,
      role: e.employeeRoles[0]?.role.displayName ?? e.employeeRoles[0]?.role.name ?? null,
      profilePhoto: e.profilePhoto,
      children: buildOrgTree(employees, e.id),
    }))
}

export async function getOrgChart(): Promise<ActionResult<{ data: OrgNode[] }>> {
  return runAction(async () => {
    // Org chart is open to every signed-in employee, not just employee:read.
    await requireSession()
    const employees = await db.employee.findMany({
      where: {
        isActive: true,
        NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
      },
      select: {
        ...EMPLOYEE_SUMMARY_SELECT,
        managerId: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
        employeeRoles: { select: { role: { select: { name: true, displayName: true } } } },
      },
    })
    return ok({ data: buildOrgTree(employees, null) })
  })
}

// The colleague card: what any employee may see about another. An allow-list, so a new Employee
// column can't leak - personal contacts, address, salary and exit status stay out.

/** Everything a colleague may see, listed once so the shape is reviewable. */
const COLLEAGUE_SELECT = {
  id: true,
  employeeNo: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  email: true,
  phone: true,
  workLocation: true,
  dateOfJoining: true,
  dateOfBirth: true,
  isActive: true,
  department: { select: { name: true } },
  designation: { select: { title: true } },
  jobRole: { select: { name: true } },
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePhoto: true,
      designation: { select: { title: true } },
    },
  },
} as const

export async function getColleagueProfile(idOrSlug: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    // Any signed-in employee (staff directory, not an HR file).
    await requireSession()

    const id = await resolveEmployeeId(idOrSlug)
    if (!id) return fail("Employee not found", undefined, 404)

    const employee = await db.employee.findFirst({
      where: {
        id,
        NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
      },
      select: COLLEAGUE_SELECT,
    })
    if (!employee) return fail("Employee not found", undefined, 404)

    const { dateOfBirth, ...rest } = employee

    return ok(
      serialize({
        data: {
          ...rest,
          designation: employee.designation?.title ?? null,
          department: employee.department?.name ?? null,
          jobRole: employee.jobRole?.name ?? null,
          manager: employee.manager
            ? {
                ...employee.manager,
                designation: employee.manager.designation?.title ?? null,
              }
            : null,
          // Day and month only - never the year.
          birthday: dateOfBirth
            ? { day: dateOfBirth.getUTCDate(), month: dateOfBirth.getUTCMonth() + 1 }
            : null,
        },
      }),
    )
  })
}
