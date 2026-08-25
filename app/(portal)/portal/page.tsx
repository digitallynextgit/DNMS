import { Link } from "@/components/tenant-link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { CLIENT_MODULES } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portal",
  description: "Choose a project to open its client portal.",
}

/**
 * Project picker. One grant → straight into it, so most clients never see this
 * page. None → an honest empty state; a client with no grant must not see a
 * project list, an id, or any hint that other projects exist.
 *
 * Standalone rather than inside the app shell: the shell's nav is per-project,
 * and there is no project chosen yet.
 */
export default async function PortalHomePage() {
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/client-login")

  const grants = await listClientGrants(session.user.id)
  if (grants.length === 1) redirect(`/portal/${grants[0]!.projectRef}`)

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Image
        src="/logo_white_bg.png"
        alt="Digitally Next"
        width={370}
        height={96}
        className="mb-10 h-9 w-auto dark:hidden"
      />
      <Image
        src="/logo_dark_bg.webp"
        alt="Digitally Next"
        width={370}
        height={96}
        className="mb-10 hidden h-9 w-auto dark:block"
      />

      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome back, {session.user.firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {grants.length
            ? "Choose a project to open."
            : "Your account is set up, but no project has been shared with you yet."}
        </p>
      </div>

      {grants.length === 0 ? (
        <div className="text-muted-foreground rounded-sm border border-dashed py-14 text-center text-sm">
          Your account manager will enable this shortly.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {grants.map((g) => (
            <Link
              key={g.projectId}
              href={`/portal/${g.projectRef}`}
              className="bg-card hover:border-foreground/30 rounded-sm border p-4 transition-colors"
            >
              <p className="text-sm font-medium">{g.projectName}</p>
              <p className="text-muted-foreground mt-2 text-[11px]">
                {g.modules
                  .map((m) => CLIENT_MODULES.find((c) => c.key === m)?.label)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
