import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AuthShell } from "@/features/auth"
import { ClientLoginForm } from "@/features/client-portal"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Client Sign In",
  description: "Sign in to your client portal",
}

export default async function ClientLoginPage() {
  const session = await auth()
  // Send whoever is already signed in to their own side of the app rather than
  // rendering a login form under a live session.
  if (session) redirect(session.user.kind === "client" ? "/portal" : "/dashboard")

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Client portal</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to view your products and store performance.
        </p>
      </div>

      <ClientLoginForm />

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Need access? Contact your account manager.
        <br />
        <Link href="/login" className="hover:text-foreground underline underline-offset-2">
          Digitally Next staff sign in here
        </Link>
      </p>
    </AuthShell>
  )
}
