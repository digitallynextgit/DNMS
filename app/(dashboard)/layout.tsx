import { auth } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { AccountDeactivated } from "@/components/auth/account-deactivated"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Sessions are stateless JWTs, so a user deactivated mid-session (e.g. an
  // approved resignation) still holds a valid cookie. Re-check isActive on every
  // dashboard navigation and force a sign-out the moment the account goes inactive.
  const account = await db.employee.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account || !account.isActive) {
    return <AccountDeactivated />
  }

  return (
    <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-[auto_1fr] overflow-hidden">
      {/* Vibrant-theme ambient background (gradient + grid + animated glow). Only
          painted when a vibrant theme is active; sits behind all content. */}
      <div className="vibrant-aura pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <Sidebar session={session} />
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-hidden">
        <Topbar session={session} />
        <main className="min-h-0 overflow-x-hidden overflow-y-auto px-6 py-4">{children}</main>
      </div>
    </div>
  )
}
