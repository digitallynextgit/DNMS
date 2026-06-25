"use client"

import { useSession } from "next-auth/react"

import { PageHeader } from "@/components/shared/page-header"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { AdminDashboard } from "@/features/dashboard"
import { EmployeeDashboard } from "@/features/dashboard"

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

      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : isManager ? (
        <AdminDashboard />
      ) : (
        <EmployeeDashboard />
      )}
    </div>
  )
}
