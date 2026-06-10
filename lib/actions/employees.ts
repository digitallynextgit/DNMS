"use server"

import { db } from "@/lib/db"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeFilterSchema,
} from "@/lib/schemas/employee"
import { generateEmployeeNo } from "@/lib/utils"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import { canAccessEmployee } from "@/lib/permissions"
import { encrypt } from "@/lib/encryption"
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

// Credentials email sent to a new employee with their first-login password.
function credentialsEmail(firstName: string, email: string, password: string) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`
  const html = `
    <p>Hi ${firstName},</p>
    <p>Your Digitally Next Management System account has been created. Use the credentials below to sign in:</p>
    <p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${password}</p>
    <p>Please sign in at <a href="${loginUrl}">${loginUrl}</a> and change your password from your profile.</p>
    <p>— Digitally Next HR</p>`
  const text = `Hi ${firstName},\n\nYour DNMS account has been created.\nEmail: ${email}\nTemporary password: ${password}\n\nSign in at ${loginUrl} and change your password.\n\n— Digitally Next HR`
  return { html, text }
}
import type { OrgNode } from "@/types"
import { requireSession, requirePermission, getAuditMeta } from "./_guard"
import { ok, fail, runAction, serialize, type ActionResult } from "./_result"

type EmployeeFilters = {
  search?: string
  departmentId?: string
  designationId?: string
  status?: string
  employmentType?: string
  page?: number
  limit?: number
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

    const { search, departmentId, designationId, status, page, limit } = parsed.data
    const skip = (page - 1) * limit

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

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
    ])

    return ok(
      serialize({
        data: employees,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }),
    )
  })
}

export async function getEmployee(id: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!canAccessEmployee(session, id)) return fail("Forbidden")

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, title: true, level: true } },
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
    return ok(serialize({ data: employee }))
  })
}

// Lightweight list of every employee with their code, used by the create form to
// show which codes are taken and to pre-fill the next free one.
export async function getEmployeeCodes(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_WRITE)
    const employees = await db.employee.findMany({
      orderBy: { employeeNo: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        profilePhoto: true,
      },
    })
    return ok(serialize({ data: employees }))
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
          managerId: data.managerId || null,
          dottedManagerId: data.dottedManagerId || null,
          employmentType: data.employmentType,
          dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : null,
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          workLocation: data.workLocation || null,
          currentAddress,
          permanentAddress,
          emergencyContact,
          passwordHash,
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

      const meta = await getAuditMeta()
      await createAuditLog(session, {
        action: "CREATE",
        module: "employee",
        entityType: "Employee",
        entityId: employee.id,
        changes: { created: { employeeNo, email: data.email } },
        ...meta,
      })

      const welcomeTemplate = await db.emailTemplate.findFirst({
        where: { slug: "welcome-email", isActive: true },
      })
      if (welcomeTemplate) {
        const html = welcomeTemplate.bodyHtml
          .replace(/\{\{firstName\}\}/g, employee.firstName)
          .replace(/\{\{lastName\}\}/g, employee.lastName)
          .replace(/\{\{email\}\}/g, employee.email)
          .replace(/\{\{employeeNo\}\}/g, employee.employeeNo)
        await addEmailJob({
          to: employee.email,
          subject: welcomeTemplate.subject,
          html,
          text: welcomeTemplate.bodyText || undefined,
        })
      }

      // Email the first-login credentials to the work + personal address (both
      // when available, otherwise whichever exists).
      const recipients = [employee.email, employee.personalEmail].filter(Boolean).join(", ")
      if (recipients) {
        const { html, text } = credentialsEmail(employee.firstName, employee.email, plainPassword)
        await addEmailJob({
          to: recipients,
          subject: "Your DNMS account credentials",
          html,
          text,
        })
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

    const updateData: Record<string, unknown> = {}
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
    if (data.managerId !== undefined) updateData.managerId = data.managerId || null
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType
    if (data.dateOfJoining !== undefined)
      updateData.dateOfJoining = data.dateOfJoining ? new Date(data.dateOfJoining) : null
    if (data.probationEndDate !== undefined)
      updateData.probationEndDate = data.probationEndDate ? new Date(data.probationEndDate) : null
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation || null
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
      profilePhoto: e.profilePhoto,
      children: buildOrgTree(employees, e.id),
    }))
}

export async function getOrgChart(): Promise<ActionResult<{ data: OrgNode[] }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EMPLOYEE_READ)
    const employees = await db.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        managerId: true,
        profilePhoto: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    })
    return ok({ data: buildOrgTree(employees, null) })
  })
}
