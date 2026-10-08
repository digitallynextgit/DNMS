import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { AuthShell } from "@/features/auth"
import { SignupForm } from "@/features/tenants"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create your workspace",
  description: "Start a 21-day DNMS trial for your company. No card required.",
  // Overrides the (auth) group's noindex: this is the public conversion page (in sitemap.xml).
  robots: { index: true, follow: true },
  alternates: { canonical: "/signup" },
}

export default async function SignupPage() {
  const session = await auth()
  // Already signed in: a second company belongs behind the account, not the public front door.
  if (session) redirect(session.user.kind === "client" ? "/portal" : "/dashboard")

  return (
    <AuthShell>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="text-muted-foreground text-sm">
          Attendance, payroll, projects and your client portal - on one system of record.
        </p>
      </div>

      <SignupForm />

      <p className="text-muted-foreground mt-6 text-center text-xs">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
