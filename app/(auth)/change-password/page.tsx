import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { AuthShell } from "@/features/auth"
import { ChangePasswordForm } from "@/features/auth"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password to continue",
}

export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session) redirect("/login")
  // Already set their own password - nothing to do here.
  if (!session.user.mustChangePassword) redirect("/dashboard")

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-muted-foreground text-sm">
          For security, choose your own password before continuing to your dashboard.
        </p>
      </div>

      <ChangePasswordForm />

      <p className="text-muted-foreground mt-6 text-center text-xs">
        This is required because your account uses a temporary password issued by HR.
      </p>
    </AuthShell>
  )
}
