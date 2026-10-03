"use client"

import { useState } from "react"
import { Bot, Check, ShieldCheck, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SCOPE_LABELS } from "../constants"
import { approveConsent, denyConsent } from "../server/consent.actions"

export interface ConsentView {
  id: string
  clientName: string
  clientKind: "cimd" | "dcr"
  redirectHost: string
  verifiedAs: string | null
  loopback: boolean
  scopes: string[]
}

interface ConsentCardProps {
  request: ConsentView
  personName: string
  personEmail: string
  workspace: string
}

/**
 * "Claude wants to access DNMS as you" - the one screen between an AI app and
 * a person's DNMS data. Shows the app, WHERE the code will be sent (the spec
 * requires the redirect host to be visible), who they are connecting as, and
 * exactly what the app will be able to do.
 */
export function ConsentCard({ request, personName, personEmail, workspace }: ConsentCardProps) {
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null)
  const name = request.verifiedAs ?? request.clientName

  async function decide(kind: "allow" | "deny") {
    setBusy(kind)
    const result = kind === "allow" ? await approveConsent(request.id) : await denyConsent(request.id)
    if (!result.ok) {
      toast.error(result.error)
      setBusy(null)
      return
    }
    if (result.data.redirectTo) {
      window.location.assign(result.data.redirectTo)
    } else {
      toast.success("Request cancelled. You can close this tab.")
      setBusy(null)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-3 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
          <Bot className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">
          {name} wants to access DNMS as you
        </h1>
        <p className="text-muted-foreground text-sm">
          Connecting as <span className="text-foreground font-medium">{personName}</span> (
          {personEmail}) in <span className="text-foreground font-medium">{workspace}</span>
        </p>
      </div>

      <div className="bg-card space-y-4 rounded-lg border p-4 text-sm">
        {request.verifiedAs ? (
          <p className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Verified: sign-in returns to <strong>{request.redirectHost}</strong> ({request.verifiedAs}
              ).
            </span>
          </p>
        ) : request.loopback ? (
          <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              A program on <strong>this computer</strong> ({request.clientName}) is asking - for
              example Claude Code or another desktop AI tool. Only allow it if you just started this
              yourself.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Sign-in returns to <strong>{request.redirectHost}</strong>. DNMS has not verified this
              app - only allow it if you trust it.
            </span>
          </p>
        )}

        <div className="space-y-2">
          <p className="font-medium">It will be able to:</p>
          <ul className="space-y-1.5">
            {request.scopes.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{SCOPE_LABELS[s] ?? s}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Only what your own DNMS role allows. Platform settings and stored passwords are never
            shared. You can disconnect it any time from AI Connections in DNMS.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy !== null}
          onClick={() => decide("deny")}
        >
          {busy === "deny" ? "Cancelling…" : "Deny"}
        </Button>
        <Button className="flex-1" disabled={busy !== null} onClick={() => decide("allow")}>
          {busy === "allow" ? "Connecting…" : "Allow"}
        </Button>
      </div>
    </div>
  )
}
