import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { createNotifications } from "@/lib/notifications"
import { employeeSlug } from "@/lib/utils"
import type { Session } from "next-auth"

/**
 * PUT /api/employees/[id]/roles
 * Replace an employee's assignable (global, non-hidden) role grants.
 * Hidden roles (e.g. admin_) are preserved untouched - they can never be
 * stripped or granted through this endpoint, so an admin can't accidentally
 * lock out the admin_ from the role picker.
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

      const employee = await db.employee.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
      })
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      // Snapshot the assignable roles BEFORE the swap so we can tell whether
      // anything actually changed (and say what it changed to).
      const rolesBefore = await db.employeeRole.findMany({
        where: { employeeId: id, scopeType: null, role: { name: { notIn: [...HIDDEN_ROLES] } } },
        select: { role: { select: { displayName: true, name: true } } },
      })

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

      // A role change alters what someone can DO, so it shouldn't happen silently.
      // Notify the employee (they also need to re-login for it to take effect) and
      // every other admin, since this is a security-relevant event.
      try {
        const label = (r: { displayName: string | null; name: string }) => r.displayName || r.name
        const beforeNames = rolesBefore.map((r) => label(r.role)).sort()
        const afterNames = updated
          .filter((er) => !(HIDDEN_ROLES as readonly string[]).includes(er.role.name))
          .map((er) => label(er.role))
          .sort()

        // No-op saves (same roles re-submitted) must not spam anyone.
        if (beforeNames.join("|") !== afterNames.join("|")) {
          const rolesText = afterNames.length ? afterNames.join(", ") : "no roles"
          const fullName = `${employee.firstName} ${employee.lastName}`.trim()
          const slug = employeeSlug(employee.employeeNo, employee.firstName, employee.lastName)

          const recipients: Parameters<typeof createNotifications>[0] = []

          // The employee themselves - unless they changed their own roles.
          if (id !== session.user.id) {
            recipients.push({
              employeeId: id,
              title: "Your access was updated",
              message: `Your role is now: ${rolesText}. Sign out and back in for it to take effect.`,
              type: "warning",
              link: `/employees/${slug}`,
            })
          }

          // Other admins - role changes are security events worth witnessing.
          const admins = await db.employee.findMany({
            where: {
              isActive: true,
              status: "ACTIVE",
              id: { notIn: [session.user.id, id] },
              employeeRoles: { some: { role: { name: "admin" } } },
            },
            select: { id: true },
          })
          for (const a of admins) {
            recipients.push({
              employeeId: a.id,
              title: "Employee roles changed",
              message: `${fullName} (${employee.employeeNo}) is now: ${rolesText}.`,
              type: "info",
              link: `/employees/${slug}`,
            })
          }

          if (recipients.length > 0) await createNotifications(recipients)
        }
      } catch (e) {
        // Never let a notification failure undo a completed role change.
        console.error("[EMPLOYEE_ROLES_PUT] notification failed", e)
      }

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[EMPLOYEE_ROLES_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
