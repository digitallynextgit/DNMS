"use client"

import { PageHeader } from "@/components/shared/page-header"
import { LeavePolicyMatrix } from "@/features/leave"
import { usePermissions } from "@/features/admin"
import { SYSTEM_ROLES } from "@/lib/constants"

export default function LeavePolicyPage() {
  const { roles, isSuperAdmin } = usePermissions()
  // Company-wide leave policy is managed by HR Manager or Admin only.
  const canManage =
    isSuperAdmin || roles.includes(SYSTEM_ROLES.HR_MANAGER) || roles.includes(SYSTEM_ROLES.ADMIN)

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">
          Only HR Managers and Admins can manage the leave policy.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Policy"
        description="Set how many days of each leave type every employment type receives per year, then re-sync balances."
      />
      <LeavePolicyMatrix />
    </div>
  )
}
