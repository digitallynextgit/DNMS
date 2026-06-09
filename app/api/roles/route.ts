/**
 * GET  /api/roles  – list all roles with permission / employee counts
 * POST /api/roles  – create a new (non-system) role
 *
 * Both endpoints are guarded by the PBAC `withAuth` wrapper from lib/permissions.ts.
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"

// ---------------------------------------------------------------------------
// GET /api/roles
// ---------------------------------------------------------------------------
export const GET = withAuth(PERMISSIONS.ROLE_READ, async () => {
  const roles = await db.role.findMany({
    where: { name: { notIn: [...HIDDEN_ROLES] } },
    include: {
      _count: {
        select: {
          rolePermissions: true,
          employeeRoles: true,
        },
      },
    },
    orderBy: [{ isSystem: "desc" }, { displayName: "asc" }],
  })

  return NextResponse.json({ data: roles })
})

// ---------------------------------------------------------------------------
// POST /api/roles
// ---------------------------------------------------------------------------
export const POST = withAuth(PERMISSIONS.ROLE_WRITE, async (req: NextRequest, _ctx, session) => {
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

  if (!name?.trim() || !displayName?.trim()) {
    return NextResponse.json({ error: "name and displayName are required" }, { status: 400 })
  }

  const normalizedName = name.toLowerCase().replace(/\s+/g, "_")

  // Check for duplicate name
  const existing = await db.role.findUnique({ where: { name: normalizedName } })
  if (existing) {
    return NextResponse.json(
      { error: `A role with name "${normalizedName}" already exists` },
      { status: 409 },
    )
  }

  const role = await db.role.create({
    data: {
      name: normalizedName,
      displayName: displayName.trim(),
      description: description?.trim() ?? null,
      isSystem: false,
      rolePermissions: {
        create: (permissionIds ?? []).map((id) => ({ permissionId: id })),
      },
    },
    include: {
      _count: { select: { rolePermissions: true, employeeRoles: true } },
    },
  })

  await createAuditLog(session, {
    action: "role:create",
    module: "role",
    entityType: "Role",
    entityId: role.id,
    changes: { name: normalizedName, displayName: displayName.trim() },
  })

  return NextResponse.json({ data: role }, { status: 201 })
})
