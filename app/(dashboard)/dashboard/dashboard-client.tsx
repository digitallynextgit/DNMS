"use client"

import { useSession } from "next-auth/react"

import { PageHeader } from "@/components/shared/page-header"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { AdminDashboard } from "@/features/dashboard"
import { EmployeeDashboard } from "@/features/dashboard"
import { AnnouncementsCard, PhotoGalleryCard, BirthdaysCard } from "@/features/noticeboard"

export function DashboardClient() {
  const { data: session, status } = useSession()
  const { can } = usePermissions()

  const today = new Date()
  const dateString = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // employee:read holders get the org-wide HR dashboard; everyone else a personal view.
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

      {/* Company-wide noticeboard, shared by both role dashboards. */}
      {!isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <AnnouncementsCard />
            <PhotoGalleryCard />
          </div>
          <BirthdaysCard />
        </div>
      )}
    </div>
  )
}
