import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/server/auth"
import { Button } from "@/components/ui/button"
import { MobileMoreMenu } from "@/components/layout/mobile-more-menu"

export const metadata: Metadata = {
  title: "More",
  description: "Everything else in DNMS: your details, work, HR and company sections.",
}

/**
 * Phone-only navigation hub (the fifth bottom tab). On desktop the sidebar
 * already lists all of this, so the route is hidden there with a CSS guard and
 * the menu simply never appears next to the sidebar.
 */
export default async function MorePage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <div className="md:hidden">
        <MobileMoreMenu session={session} />
      </div>
      {/* Desktop reaches every one of these from the sidebar, but the route is
          still bookmarkable (and a phone user can rotate/resize into it), so it
          points somewhere instead of rendering an empty shell. */}
      <div className="hidden md:flex md:min-h-[60vh] md:flex-col md:items-center md:justify-center md:gap-3 md:text-center">
        <p className="text-sm font-medium">Everything here is in the sidebar</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          This menu exists for phone screens. On a wider screen use the navigation on the left.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </>
  )
}
