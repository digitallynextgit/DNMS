"use client"

import { useSession } from "next-auth/react"

import { PageHeader } from "@/components/shared/page-header"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { EmployeeDashboard } from "@/features/dashboard"
import { AnnouncementsCard, PhotoGalleryCard, BirthdaysCard } from "@/features/noticeboard"

export function DashboardClient() {
  const { data: session, status } = useSession()

  const today = new Date()
  const dateString = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // One personal home page for every role; company-wide numbers live on Analytics.
  const roles = session?.user.roles ?? []
  const isAdmin = roles.includes("admin") || roles.includes("admin_")
  const firstName = session?.user.firstName
  const isLoading = status === "loading"

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading || !firstName ? "Dashboard" : `Welcome back, ${firstName}`}
        description={dateString}
      />

      {isLoading ? <CardGridSkeleton count={4} /> : <EmployeeDashboard showRating={!isAdmin} />}

      {/* Company-wide noticeboard. */}
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
