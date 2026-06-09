"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { CheckCircle2, XCircle } from "lucide-react"

interface Permission {
  id: string
  scope: string
  module: string
  action: string
  description?: string | null
}

interface Role {
  id: string
  name: string
  displayName: string
  isSystem: boolean
  rolePermissions: { permissionId: string }[]
}

export default function PermissionsPage() {
  const { data: permissionsData, isLoading: loadingPerms } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const res = await fetch("/api/permissions")
      const json = await res.json()
      return json.data as { module: string; permissions: Permission[] }[]
    },
  })

  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles")
      const json = await res.json()
      return json.data as Role[]
    },
  })

  const isLoading = loadingPerms || loadingRoles

  const hasPermission = (role: Role, permId: string) =>
    role.rolePermissions.some((rp) => rp.permissionId === permId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permission Matrix"
        description="View which roles have access to each permission scope"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role × Permission Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="min-w-[200px] py-2 pr-4 text-left font-medium text-slate-600">
                      Permission
                    </th>
                    {rolesData?.map((role) => (
                      <th
                        key={role.id}
                        className="min-w-[100px] px-3 py-2 text-center font-medium text-slate-600"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{role.displayName}</span>
                          {role.isSystem && (
                            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                              System
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionsData?.map((group) => (
                    <>
                      <tr key={`group-${group.module}`}>
                        <td colSpan={(rolesData?.length ?? 0) + 1} className="px-0 pt-4 pb-1">
                          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                            {group.module}
                          </span>
                        </td>
                      </tr>
                      {group.permissions.map((perm) => (
                        <tr key={perm.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-2 pr-4">
                            <div>
                              <code className="font-mono text-xs text-slate-700">{perm.scope}</code>
                              {perm.description && (
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </td>
                          {rolesData?.map((role) => (
                            <td key={role.id} className="px-3 py-2 text-center">
                              {role.name === "super_admin" || hasPermission(role, perm.id) ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="mx-auto h-4 w-4 text-slate-200" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
