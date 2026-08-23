import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { AuthShell } from "@/features/auth"
import { ClientSetPasswordForm } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Set your password",
  description: "Set the password for your client portal account.",
}

/**
 * Where proxy.ts parks a client whose `mustChangePassword` flag is set - i.e.
 * everyone signing in for the first time with the temporary password we emailed.
 */
export default async function ClientSetPasswordPage() {
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/client-login")
  if (!session.user.mustChangePassword) redirect("/portal")

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a password</h1>
        <p className="text-muted-foreground text-sm">
          Set your own password to finish activating your portal account.
        </p>
      </div>

      <ClientSetPasswordForm />
    </AuthShell>
  )
}
