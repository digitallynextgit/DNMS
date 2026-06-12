"use client"

import { useSession } from "next-auth/react"

import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { AdminDashboard } from "@/components/dashboard/admin-dashboard"
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard"

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { can } = usePermissions()

  const today = new Date()
  const dateString = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // HR / admin roles can read the employee directory - they get the org-wide
  // HR dashboard. Regular employees (self-service only) get a personal view.
  const isManager = can(PERMISSIONS.EMPLOYEE_READ)
  const firstName = session?.user.firstName
  const isLoading = status === "loading"

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading || isManager || !firstName ? "Dashboard" : `Welcome back, ${firstName}`}
        description={dateString}
      />

      {isLoading ? <DashboardSkeleton /> : isManager ? <AdminDashboard /> : <EmployeeDashboard />}
    </div>
  )
}
