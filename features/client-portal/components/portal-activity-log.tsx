"use client"

/**
 * The client's own activity feed.
 *
 * Reads client_activity_logs, which is a different table from the staff audit
 * log by design - nothing here can surface an employee's actions.
 *
 * Rows carry a `summary` written at the time of the action, so the wording is
 * whatever was true then ("Sent the campaign "Diwali Preview" to 311
 * recipients") rather than a label reverse-engineered from an action code later.
 * The code is only a fallback for rows written before a summary existed.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, Mail, FileText, Users, Server, LogIn, KeyRound } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"

interface ActivityEvent {
  id: string
  action: string
  module: string
  summary: string | null
  entityType: string | null
  projectId: string | null
  ipAddress: string | null
  createdAt: string
}

/** Icon per action family. Falls back to a generic dot for anything unmapped. */
function iconFor(action: string): React.ComponentType<{ className?: string }> {
  if (action.startsWith("campaign:")) return Mail
  if (action.startsWith("project_template:")) return FileText
  if (action.startsWith("recipient")) return Users
  if (action.startsWith("project_mailer:")) return Server
  if (action.startsWith("auth:signin")) return LogIn
  if (action.startsWith("auth:password")) return KeyRound
  return Activity
}

/** Last-resort label when a row predates summaries: "campaign:queue" → "Campaign queue". */
function fallbackLabel(action: string): string {
  const words = action.replace(/[:_]/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function PortalActivityLog({ projectRef }: { projectRef: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["portal-activity", projectRef],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: { events: ActivityEvent[]; projectName: string } } }>(
          `/api/portal/projects/${projectRef}/activity`,
        )
      ).data.data,
  })

  const events = data?.events ?? []

  if (isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nothing yet"
        description="Actions you take in the portal will be listed here."
        variant="card"
      />
    )
  }

  return (
    <div className="divide-y rounded-md border">
      {events.map((e) => {
        const Icon = iconFor(e.action)
        const when = new Date(e.createdAt)
        return (
          <div key={e.id} className="flex items-start gap-3 px-3 py-2.5">
            <div className="bg-muted mt-0.5 rounded-full p-1.5">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{e.summary ?? fallbackLabel(e.action)}</p>
              <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                {/* suppressHydrationWarning: the server renders this in its own
                    timezone and the browser in the reader's - the mismatch is
                    expected here, not a bug to chase. */}
                <span suppressHydrationWarning>
                  {when.toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {e.ipAddress && <span className="font-mono opacity-70">{e.ipAddress}</span>}
              </p>
            </div>
            {/* Account-level events are not tied to this project; say so rather
                than letting them read as something done here. */}
            {e.projectId === null && (
              <Badge variant="outline" className={cn("shrink-0 text-[10px]")}>
                Account
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}
