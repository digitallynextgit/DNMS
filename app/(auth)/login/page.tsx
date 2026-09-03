import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "@/features/auth"
import { AuthShell } from "@/features/auth"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your DNMS account",
}

export default async function LoginPage() {
  const session = await auth()
  // Already signed in: send them to their own surface. A client holds a valid
  // session too (this is the one login point since M2), and theirs is /portal.
  if (session) redirect(session.user.kind === "client" ? "/portal" : "/dashboard")

  return (
    <AuthShell>
      {/* heading */}
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
      </div>

      <LoginForm />

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Having trouble signing in? Staff, contact your HR administrator. Clients, contact your
        account manager.
      </p>
    </AuthShell>
  )
}
