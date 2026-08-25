import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { db } from "@/server/db"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileTabbar } from "@/components/layout/mobile-tabbar"
import { RealtimeNotifications } from "@/components/providers/realtime-notifications"
import { FollowUpConflictDialog } from "@/components/providers/follow-up-conflict-dialog"
import { AiAssistant } from "@/components/shared/ai-assistant"
import { AccountDeactivated } from "@/features/auth"

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
    <div className="dashboard-shell bg-background fixed inset-0 grid grid-cols-1 overflow-hidden md:grid-cols-[auto_1fr]">
      <RealtimeNotifications />
      {/* Mounted once for the whole app: the "keep or remove this follow-up?"
          question can be raised from any screen that changes a task's status. */}
      <FollowUpConflictDialog />
      {/* Phones get the bottom tab bar instead: the rail alone would eat 56px
          of a 390px viewport, leaving too little for the content column. */}
      <div className="hidden md:contents">
        <Sidebar session={session} />
      </div>
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
        <Topbar session={session} />
        <main className="min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6">
          {children}
        </main>
        <MobileTabbar />
      </div>
      <AiAssistant />
    </div>
  )
}
