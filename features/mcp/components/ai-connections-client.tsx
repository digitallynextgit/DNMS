"use client"

import { useState } from "react"
import { Bot, Check, Copy, ShieldCheck, Unplug } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import {
  useAiConnections,
  useDisconnectAiApp,
  type ConnectionRow,
} from "../hooks/use-ai-connections"

const REASONS: Record<string, string> = {
  disconnected_by_user: "Disconnected",
  disconnected_by_admin: "Disconnected by admin",
  revoked_by_app: "Disconnected from the app",
  password_changed: "Password changed",
  membership_inactive: "Account deactivated",
  refresh_token_reused: "Security: token reuse",
  authorization_code_replayed: "Security: code reuse",
}

/**
 * /ai-connections: connect AI apps and manage connections. role:write holders also see everyone's.
 */
export function AiConnectionsClient({ connectorUrl }: { connectorUrl: string }) {
  const { can, isLoading: permsLoading } = usePermissions()
  const canManage = can(PERMISSIONS.ROLE_WRITE)
  const mine = useAiConnections("mine")
  const all = useAiConnections("all", !permsLoading && canManage)
  const disconnect = useDisconnectAiApp()
  const [target, setTarget] = useState<ConnectionRow | null>(null)
  const [copied, setCopied] = useState(false)

  async function copyUrl() {
    await navigator.clipboard.writeText(connectorUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function confirmDisconnect() {
    if (!target) return
    disconnect.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.app} disconnected`)
        setTarget(null)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  const baseColumns: DataTableColumn<ConnectionRow>[] = [
    {
      header: "App",
      sortValue: (r) => r.verifiedAs ?? r.app,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.verifiedAs ?? r.app}</span>
          {r.verifiedAs && (
            <ShieldCheck className="size-3.5 text-emerald-600" aria-label="Verified" />
          )}
        </div>
      ),
    },
    {
      header: "Access",
      sortValue: (r) => (r.scope.includes("hrms:write") ? "Read & change" : "Read only"),
      cell: (r) => (r.scope.includes("hrms:write") ? "Read & change" : "Read only"),
    },
    {
      header: "Connected",
      sortValue: (r) => r.createdAt,
      cell: (r) => formatDateTime(r.createdAt),
    },
    {
      header: "Last used",
      sortValue: (r) => r.lastUsedAt,
      cell: (r) => (r.lastUsedAt ? formatRelativeTime(r.lastUsedAt) : "Never"),
    },
    {
      header: "Requests (30d)",
      align: "right",
      sortValue: (r) => r.callsLast30Days,
      cell: (r) => r.callsLast30Days,
    },
    {
      header: "Status",
      sortValue: (r) =>
        r.revokedAt ? (REASONS[r.revokedReason ?? ""] ?? "Disconnected") : "Active",
      cell: (r) =>
        r.revokedAt ? (
          <Badge variant="secondary">{REASONS[r.revokedReason ?? ""] ?? "Disconnected"}</Badge>
        ) : (
          <Badge>Active</Badge>
        ),
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.revokedAt ? null : (
          <Button variant="outline" onClick={() => setTarget(r)}>
            <Unplug className="size-4" />
            Disconnect
          </Button>
        ),
    },
  ]
  const everyoneColumns: DataTableColumn<ConnectionRow>[] = [
    {
      header: "Person",
      sortValue: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : null),
      cell: (r) =>
        r.employee
          ? `${r.employee.firstName} ${r.employee.lastName} (${r.employee.employeeNo})`
          : "-",
    },
    ...baseColumns,
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Connections"
        description="Use DNMS from Claude or ChatGPT. Ask questions in plain English, approve requests and more - with exactly your DNMS permissions."
      />

      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <Bot className="text-primary size-5" />
          <h2 className="font-semibold">Connect an AI app</h2>
        </div>
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-sm">DNMS connector URL</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 text-sm">
              {connectorUrl}
            </code>
            <Button variant="outline" onClick={copyUrl}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Steps
            title="Claude (web or desktop)"
            steps={[
              "Customize → Connectors → + → Add custom connector (Team/Enterprise: an Owner adds it under Organization settings → Connectors)",
              "Paste the URL above and click Connect",
              "Log in to DNMS and click Allow",
            ]}
          />
          <Steps
            title="ChatGPT (Business / Enterprise)"
            steps={[
              "An admin turns on Developer mode, then Workspace settings → Apps → Create",
              "Paste the URL, choose OAuth, click Scan Tools, log in to DNMS and Allow",
              "Publish it to the workspace; each person connects it under Settings → Apps",
            ]}
          />
          <Steps
            title="Claude Code"
            steps={[
              `Run: claude mcp add --transport http dnms ${connectorUrl}`,
              "In Claude Code type /mcp and choose dnms",
              "Log in to DNMS in the browser and click Allow",
            ]}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          The AI can see and do only what your own DNMS role allows - read and, with your
          confirmation, change things. Platform settings and stored passwords are never shared. What
          you ask is processed by the AI provider (Anthropic or OpenAI).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Your connections</h2>
        {!mine.isLoading && (mine.data?.length ?? 0) === 0 ? (
          <EmptyState
            variant="card"
            compact
            icon={Bot}
            title="No AI apps connected"
            description="Connect Claude or ChatGPT with the URL above."
          />
        ) : (
          <DataTable
            columns={baseColumns}
            rows={mine.data ?? []}
            rowKey={(r) => r.id}
            loading={mine.isLoading}
            skeletonRows={2}
            minWidth="min-w-[760px]"
            itemLabel="connection"
            columnToggle={false}
          />
        )}
      </section>

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-semibold">Everyone in this workspace</h2>
          {!all.isLoading && (all.data?.length ?? 0) === 0 ? (
            <EmptyState
              variant="card"
              compact
              icon={Bot}
              title="Nobody has connected an AI app yet"
            />
          ) : (
            <DataTable
              tableId="ai-connections"
              itemLabel="connection"
              columns={everyoneColumns}
              rows={all.data ?? []}
              rowKey={(r) => r.id}
              loading={all.isLoading}
              skeletonRows={3}
              minWidth="min-w-[960px]"
            />
          )}
        </section>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Disconnect ${target?.verifiedAs ?? target?.app ?? "this app"}?`}
        description="It loses access to DNMS immediately. Connecting again means logging in and clicking Allow again."
        confirmLabel="Disconnect"
        variant="destructive"
        isLoading={disconnect.isPending}
        onConfirm={confirmDisconnect}
      />
    </div>
  )
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">{title}</p>
      <ol className="text-muted-foreground list-decimal space-y-1 pl-4">
        {steps.map((s) => (
          <li key={s} className="break-words">
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}
