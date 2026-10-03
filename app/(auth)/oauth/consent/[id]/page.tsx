import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthShell } from "@/features/auth"
import { ConsentCard } from "@/features/mcp"
import { getConsentScreen } from "@/features/mcp/server/oauth.service"
import { tenantScopedSession } from "@/server/tenant-request"

export const metadata: Metadata = { title: "Connect an AI app" }
export const dynamic = "force-dynamic"

// /oauth/consent/[id] - the AI-connector consent screen. Login-protected by the
// proxy (logged-out visitors go to /login?callbackUrl=/oauth/consent/<id> and
// come back). Routing glue: the decision lives in features/mcp.
export default async function OAuthConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await tenantScopedSession()
  if (!session) redirect(`/login?callbackUrl=/oauth/consent/${id}`)

  const screen = session.user.kind === "employee" ? await getConsentScreen(id, session) : null

  return (
    <AuthShell>
      <div className="flex w-full justify-center">
        {session.user.kind !== "employee" ? (
          <Message
            title="Not available for client accounts"
            text="Only DNMS staff accounts can connect AI apps."
          />
        ) : !screen ? (
          <Message
            title="This sign-in link has expired"
            text="Go back to the AI app and start connecting DNMS again. Links last 10 minutes."
          />
        ) : (
          <ConsentCard
            request={screen.request}
            personName={`${session.user.firstName} ${session.user.lastName}`.trim()}
            personEmail={session.user.email}
            workspace={screen.workspace}
          />
        )}
      </div>
    </AuthShell>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-md space-y-2 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  )
}
