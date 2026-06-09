/**
 * GET    /api/roles/:id  – fetch a single role with its full permission list
 * PATCH  /api/roles/:id  – update a role's displayName, description, and permissions
 * DELETE /api/roles/:id  – delete a non-system role
 *
 * Rules:
 *  - System roles (isSystem = true) cannot have their `name` changed.
 *  - System roles cannot be deleted.
 *  - All three verbs require ROLE_READ / ROLE_WRITE permission respectively.
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"

type RouteContext = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET /api/roles/:id
// ---------------------------------------------------------------------------
export const GET = withAuth(PERMISSIONS.ROLE_READ, async (_req: NextRequest, ctx: RouteContext) => {
  const { id } = ctx.params

  const role = await db.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
        orderBy: { permission: { scope: "asc" } },
      },
      _count: { select: { employeeRoles: true } },
    },
  })

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 })
  }

  return NextResponse.json({ data: role })
})

// ---------------------------------------------------------------------------
// PATCH /api/roles/:id
// ---------------------------------------------------------------------------
export const PATCH = withAuth(
  PERMISSIONS.ROLE_WRITE,
  async (req: NextRequest, ctx: RouteContext, session) => {
    const { id } = ctx.params

    const role = await db.role.findUnique({ where: { id } })
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { name, displayName, description, permissionIds } = body as {
      name?: string
      displayName?: string
      description?: string
      permissionIds?: string[]
    }

    // Block renaming the internal `name` slug of system roles.
    if (role.isSystem && name && name !== role.name) {
      return NextResponse.json(
        { error: "The internal name of a system role cannot be changed" },
        { status: 422 },
      )
    }

    // If a new name is provided for a non-system role, ensure it's unique.
    let normalizedName: string | undefined
    if (name && !role.isSystem) {
      normalizedName = name.toLowerCase().replace(/\s+/g, "_")
      if (normalizedName !== role.name) {
        const conflict = await db.role.findUnique({
          where: { name: normalizedName },
        })
        if (conflict) {
          return NextResponse.json(
            { error: `A role with name "${normalizedName}" already exists` },
            { status: 409 },
          )
        }
      }
    }

    // Build the update payload
    const updateData: Parameters<typeof db.role.update>[0]["data"] = {}
    if (normalizedName !== undefined) updateData.name = normalizedName
    if (displayName !== undefined) updateData.displayName = displayName.trim()
    if (description !== undefined) updateData.description = description?.trim() ?? null

    // Replace all permissions when permissionIds is provided in the request.
    if (permissionIds !== undefined) {
      // Delete existing and re-create in a transaction.
      const [updatedRole] = await db.$transaction([
        db.role.update({
          where: { id },
          data: updateData,
          include: {
            rolePermissions: { include: { permission: true } },
            _count: { select: { rolePermissions: true, employeeRoles: true } },
          },
        }),
        db.rolePermission.deleteMany({ where: { roleId: id } }),
        ...permissionIds.map((permissionId) =>
          db.rolePermission.create({ data: { roleId: id, permissionId } }),
        ),
      ])

      await createAuditLog(session, {
        action: "role:update",
        module: "role",
        entityType: "Role",
        entityId: id,
        changes: { ...updateData, permissionIds } as object,
      })

      // Re-fetch to get the updated rolePermissions after transaction
      const freshRole = await db.role.findUnique({
        where: { id },
        include: {
          rolePermissions: { include: { permission: true } },
          _count: { select: { rolePermissions: true, employeeRoles: true } },
        },
      })

      return NextResponse.json({ data: freshRole ?? updatedRole })
    }

    // No permission changes – just update the role metadata.
    const updatedRole = await db.role.update({
      where: { id },
      data: updateData,
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { rolePermissions: true, employeeRoles: true } },
      },
    })

    await createAuditLog(session, {
      action: "role:update",
      module: "role",
      entityType: "Role",
      entityId: id,
      changes: updateData as object,
    })

    return NextResponse.json({ data: updatedRole })
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/roles/:id
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  PERMISSIONS.ROLE_WRITE,
  async (_req: NextRequest, ctx: RouteContext, session) => {
    const { id } = ctx.params

    const role = await db.role.findUnique({ where: { id } })
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    if (role.isSystem) {
      return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 422 })
    }

    // Check if there are employees currently assigned to this role.
    const employeeCount = await db.employeeRole.count({ where: { roleId: id } })
    if (employeeCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role: ${employeeCount} employee(s) are currently assigned to it`,
        },
        { status: 422 },
      )
    }

    await db.role.delete({ where: { id } })

    await createAuditLog(session, {
      action: "role:delete",
      module: "role",
      entityType: "Role",
      entityId: id,
      changes: { name: role.name, displayName: role.displayName } as object,
    })

    return NextResponse.json({ data: { id } })
  },
)
