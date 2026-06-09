import { auth } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your DNMS account",
}

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <AuthShell>
      {/* heading */}
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
      </div>

      <LoginForm />

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Having trouble signing in? Contact your HR administrator.
      </p>
    </AuthShell>
  )
}
