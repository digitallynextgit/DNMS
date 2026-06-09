import { auth } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="bg-background fixed inset-0 grid grid-cols-[auto_1fr] overflow-hidden">
      <Sidebar session={session} />
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-hidden">
        <Topbar session={session} />
        <main className="min-h-0 overflow-x-hidden overflow-y-auto px-6 py-4">{children}</main>
      </div>
    </div>
  )
}
