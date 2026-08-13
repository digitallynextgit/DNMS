import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { db } from "@/server/db"

/**
 * Portal route group. proxy.ts already keeps staff out and signed-out visitors
 * on /client-login; this re-checks server-side (defence in depth) and, like the
 * dashboard layout, re-reads isActive on every navigation - a stateless JWT
 * outlives an account being disabled.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/client-login")
  if (session.user.kind !== "client") redirect("/dashboard")

  const account = await db.clientUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!account?.isActive) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Access unavailable</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Your portal access has been turned off. Please contact your account manager.
        </p>
      </div>
    )
  }

  return <div className="bg-background min-h-dvh">{children}</div>
}
