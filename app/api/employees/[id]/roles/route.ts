import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

/**
 * PUT /api/employees/[id]/roles
 * Replace an employee's assignable (global, non-hidden) role grants.
 * Hidden roles (e.g. super_admin) are preserved untouched - they can never be
 * stripped or granted through this endpoint, so an admin can't accidentally
 * lock out the super admin from the role picker.
 */
export const PUT = withAuth(
  PERMISSIONS.ROLE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params

      let body: unknown
      try {
        body = await req.json()
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }

      const { roleIds } = body as { roleIds?: string[] }
      if (!Array.isArray(roleIds)) {
        return NextResponse.json({ error: "roleIds (array) is required" }, { status: 400 })
      }
      const uniqueIds = [...new Set(roleIds)]

      const employee = await db.employee.findUnique({ where: { id }, select: { id: true } })
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      // Validate every incoming role exists and is assignable (not hidden).
      if (uniqueIds.length > 0) {
        const roles = await db.role.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        })
        if (roles.length !== uniqueIds.length) {
          return NextResponse.json({ error: "One or more roles do not exist" }, { status: 400 })
        }
        if (roles.some((r) => (HIDDEN_ROLES as readonly string[]).includes(r.name))) {
          return NextResponse.json(
            { error: "That role cannot be assigned from here." },
            { status: 400 },
          )
        }
      }

      await db.$transaction(async (tx) => {
        // Replace only assignable global grants - leave hidden + scoped grants intact.
        await tx.employeeRole.deleteMany({
          where: { employeeId: id, scopeType: null, role: { name: { notIn: [...HIDDEN_ROLES] } } },
        })
        // createMany is avoided (pg-adapter quirk) - insert one row at a time.
        for (const roleId of uniqueIds) {
          await tx.employeeRole.create({ data: { employeeId: id, roleId } })
        }
      })

      await createAuditLog(session, {
        action: "employee:roles:update",
        module: "role",
        entityType: "Employee",
        entityId: id,
        changes: { roleIds: uniqueIds },
      })

      const updated = await db.employeeRole.findMany({
        where: { employeeId: id },
        include: { role: { select: { id: true, name: true, displayName: true } } },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[EMPLOYEE_ROLES_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
