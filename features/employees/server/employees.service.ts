import "server-only"

import { db } from "@/server/db"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeFilterSchema,
} from "@/features/employees/schemas/employee.schema"
import { generateEmployeeNo } from "@/lib/utils"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import { getConfig } from "@/server/app-config"
import { canAccessEmployee } from "@/lib/permissions"
// Server-only cross-feature call (not the client barrel): seed leave balances
// from the policy matrix when a new hire is created.
import { allocateFromPolicy } from "@/features/leave/server/leave-accrual.service"
import { encrypt } from "@/lib/crypto"
import bcrypt from "bcryptjs"
import { randomInt } from "crypto"

// Generate a readable, reasonably strong initial password to email to a new
// hire. Avoids ambiguous characters (0/O, 1/l/I).
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

// Enforce that every email is globally unique across employees: a work or
// personal email may not match ANY other employee's work OR personal email
// (case-insensitive), and one employee's own two emails must differ. Returns a
// user-facing error string, or null when the emails are free to use.
async function checkEmailUniqueness(
  email: string,
  personalEmail: string | null | undefined,
  excludeId?: string,
): Promise<string | null> {
  const work = email.trim().toLowerCase()
  const personal = personalEmail?.trim().toLowerCase() || null

  // A single employee may reuse the same address for both work and personal email
  // (e.g. interns / contractors with only one inbox). We only block an email that
  // belongs to a DIFFERENT employee, so collapse identical values to one candidate.
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
    if (departmentId) where.departmentId = departmentId
    if (designationId) where.designationId = designationId
    if (status) where.status = status
    // Admin_ is a hidden watch account - never list it in the directory.
    where.NOT = { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        // Explicit select (not `include`) - see EMPLOYEE_LIST_SELECT.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resolve a route param that is either a raw UUID or a "<code>-<name>" slug
// (e.g. "8-diwakar-jha") to the employee's id. The code may itself contain
// dashes (EMP-2026-0001), so we try every leading dash-prefix of the slug.
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
      // passwordHash stays globally omitted (server/db.ts). gmailAppPassword is
      // opted back IN only to derive the boolean flag below - the ciphertext is
      // stripped again before this leaves the server.
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
    // Never expose the encrypted App Password ciphertext to the client - return
    // only a boolean flag so the UI can show the "set / change / delete" state.
    const { gmailAppPassword, ...rest } = employee
    return ok(serialize({ data: { ...rest, hasGmailAppPassword: !!gmailAppPassword } }))
  })
}

// Lightweight list of every employee with their code, used by the create form to
// show which codes are taken and to pre-fill the next free one.
export async function getEmployeeCodes(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const employees = await db.employee.findMany({
      // Hide the silent watch (admin_) account from the codes list, same as the
      // directory, org chart, and analytics.
      where: { NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } } },
      orderBy: { employeeNo: "asc" },
      select: EMPLOYEE_SUMMARY_SELECT,
    })
    return ok(serialize({ data: employees }))
  })
}

// Live availability check for a single email value, used by the create/edit form
// to flag duplicates as the user types. A value is unavailable if it matches any
// other employee's work OR personal email (case-insensitive). `excludeId` skips
// the employee being edited so their own current emails read as available.
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
      // Honor a provided employee code (the form now requires it); fall back to
      // auto-generation only when blank. Provided codes must be unique.
      const providedNo = data.employeeNo?.trim()
      if (providedNo) {
        const existing = await db.employee.findUnique({
          where: { employeeNo: providedNo },
          select: { id: true },
        })
        if (existing) return fail("An employee with this code already exists")
      }

      const emailError = await checkEmailUniqueness(data.email, data.personalEmail)
      if (emailError) return fail(emailError)

      const totalCount = await db.employee.count()
      const employeeNo = providedNo || generateEmployeeNo(totalCount + 1)

      // Auto-generate an initial password when none was supplied so we can email
      // the new hire their first-login credentials.
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
          // Probation + biometric fields are collected by the create form; persist
          // them (DB defaults to onProbation=true / probationMonths=6 when omitted).
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

      // Seed this year's leave balances from the policy matrix (monthly accrual
      // pro-rates by join date). Best-effort - must not block employee creation.
      try {
        await allocateFromPolicy(employee.id, new Date().getFullYear())
      } catch (e) {
        console.error("[createEmployee] leave allocation failed", e)
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

      // One branded welcome + credentials email to the work + personal address
      // (both when available), via the notifications relay.
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

    // Re-check uniqueness whenever either email is being changed. Fall back to the
    // stored value for the field that isn't part of this update.
    if (data.email !== undefined || data.personalEmail !== undefined) {
      const nextEmail = data.email !== undefined ? data.email : before.email
      const nextPersonal =
        data.personalEmail !== undefined ? data.personalEmail || null : before.personalEmail
      const emailError = await checkEmailUniqueness(nextEmail, nextPersonal, id)
      if (emailError) return fail(emailError)
    }

    const updateData: Record<string, unknown> = {}
    // Employee code is editable; a changed value must stay unique across the table.
    if (data.employeeNo !== undefined) {
      const nextNo = data.employeeNo.trim()
      if (nextNo && nextNo !== before.employeeNo) {
        const dupe = await db.employee.findUnique({
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
    // Confirming probation early (toggling "on probation" off) records WHEN it
    // happened, so leave starts accruing from that date instead of the original
    // joining + probationMonths window.
    if (data.onProbation === false && before.onProbation && !before.confirmationDate) {
      updateData.confirmationDate = new Date()
    }
    // Only overwrite the App Password when a new one is supplied; blank means
    // "leave the existing value unchanged".
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

      // Refresh this year's leave balances when something that drives accrual
      // changed (confirmation, joining date, employment type), so it takes effect
      // immediately rather than waiting for the monthly accrual cron. Best-effort.
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

      return ok(serialize({ data: employee }))
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        return fail("Email already in use by another employee")
      throw e
    }
  })
}

// Self-service resignation: the signed-in employee marks themselves RESIGNED.
// No special permission needed (it only ever affects the caller's own record).
// Resignation is now a manager/HR-approved workflow. See applyResignation /
// reviewResignation in features/resignations/server/resignations.service.ts.

export async function deactivateEmployee(id: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EMPLOYEE_DELETE)
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return fail("Employee not found")
    if (id === session.user.id) return fail("You can't deactivate your own account")

    await db.employee.update({ where: { id }, data: { isActive: false } })
    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "DEACTIVATE",
      module: "employee",
      entityType: "Employee",
      entityId: id,
      changes: { previousIsActive: existing.isActive, previousStatus: existing.status },
      ...meta,
    })
    return ok({ message: "Employee deactivated" })
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
    // Org chart is visible to every signed-in employee (matches the page route,
    // which proxy.ts gates with `null`), not just those with employee:read.
    await requireSession()
    const employees = await db.employee.findMany({
      // Exclude the hidden admin_ watch account from the org chart.
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
