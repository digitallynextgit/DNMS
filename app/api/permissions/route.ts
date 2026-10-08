import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"

export const GET = withAuth(PERMISSIONS.ROLE_READ, async () => {
  const permissions = await db.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  })

  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = []
    }
    acc[permission.module].push(permission)
    return acc
  }, {})

  const data = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, perms]) => ({ module, permissions: perms }))

  return NextResponse.json({ data })
})
