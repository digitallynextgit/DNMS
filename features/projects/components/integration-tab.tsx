"use client"

import { useState } from "react"
import { Check, Pencil, Trash2, RefreshCw, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { TONE } from "@/lib/constants"
import { FacebookIcon, PROVIDERS } from "./meta-shared"
import {
  useProjectIntegration,
  useConnectMeta,
  useSyncMeta,
  useDisconnectMeta,
  fetchMetaCredentials,
} from "../hooks/use-integration"

/**
 * Integration tab = CONNECTIONS MANAGER. Connect/manage each ad platform here;
 * the synced data is shown in the Insights tab (with a sub-tab per platform).
 */
export function IntegrationTab({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) {
  const { data, isLoading } = useProjectIntegration(projectId)

  if (isLoading) return <ListSkeleton rows={3} height="h-24" className="mt-4" />

  return (
    <div className="mt-4 space-y-3">
      <p className="text-muted-foreground text-sm">
        Connect this project&apos;s ad platforms. Once connected, the performance data shows in the{" "}
        <span className="text-foreground font-medium">Insights</span> tab.
      </p>

      <MetaConnectionCard projectId={projectId} canManage={canManage} data={data} />

      {/* Future platforms - shown so the multi-integration structure is visible. */}
      {PROVIDERS.filter((p) => !p.live).map((p) => (
        <Card key={p.id} className="opacity-70">
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.label[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-muted-foreground text-xs">Coming soon</p>
            </div>
            <Lock className="text-muted-foreground h-4 w-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MetaConnectionCard({
  projectId,
  canManage,
  data,
}: {
  projectId: string
  canManage: boolean
  data: ReturnType<typeof useProjectIntegration>["data"]
}) {
  const connect = useConnectMeta(projectId)
  const sync = useSyncMeta(projectId)
  const disconnect = useDisconnectMeta(projectId)

  const connected = !!data?.connected
  const [editing, setEditing] = useState(false)
  const [loadingCreds, setLoadingCreds] = useState(false)
  const [form, setForm] = useState({ appId: "", appSecret: "", accessToken: "", adAccountId: "" })
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  async function startEdit() {
    // On an existing connection, load the (decrypted) values so they show pre-filled.
    if (connected) {
      setLoadingCreds(true)
      const creds = await fetchMetaCredentials(projectId).catch(() => null)
      setLoadingCreds(false)
      setForm(
        creds ?? {
          appId: data?.appId ?? "",
          appSecret: "",
          accessToken: "",
          adAccountId: data?.adAccountId ?? "",
        },
      )
    } else {
      setForm({ appId: "", appSecret: "", accessToken: "", adAccountId: "" })
    }
    setEditing(true)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1877F2]/10">
              <FacebookIcon className="h-4 w-4 text-[#1877F2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Meta Ads</p>
                <StatusBadge
                  status={connected ? "connected" : "pending"}
                  colorMap={{ connected: TONE.green, pending: TONE.neutral }}
                  labelMap={{ connected: "Connected", pending: "Not connected" }}
                  size="xs"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Facebook &amp; Instagram campaign performance.
              </p>
            </div>
          </div>

          {canManage && !editing && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={startEdit} loading={loadingCreds}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> {connected ? "Edit" : "Connect"}
              </Button>
              {connected && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Disconnect"
                  onClick={() => setDisconnectOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Connected summary (read state) */}
        {connected && !editing && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {data?.adAccountId && <span>Account: act_{data.adAccountId}</span>}
            {data?.lastSyncedAt && (
              <span>Last synced {new Date(data.lastSyncedAt).toLocaleString("en-IN")}</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7"
              onClick={() => sync.mutate(undefined)}
              loading={sync.isPending}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sync now
            </Button>
          </div>
        )}

        {data?.lastSyncError && !editing && (
          <p className="text-destructive text-xs">Last error: {data.lastSyncError}</p>
        )}

        {/* Edit form */}
        {editing && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Ad Account ID"
                required
                value={form.adAccountId}
                onChange={(v) => setForm((f) => ({ ...f, adAccountId: v }))}
                placeholder="744544010578457"
              />
              <Field
                label="App ID"
                value={form.appId}
                onChange={(v) => setForm((f) => ({ ...f, appId: v }))}
              />
              <Field
                label="App Secret"
                value={form.appSecret}
                onChange={(v) => setForm((f) => ({ ...f, appSecret: v }))}
              />
              <Field
                label="Access Token"
                required={!connected}
                value={form.accessToken}
                onChange={(v) => setForm((f) => ({ ...f, accessToken: v }))}
                className="sm:col-span-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setForm({ appId: "", appSecret: "", accessToken: "", adAccountId: "" })
                  setEditing(false)
                }}
                disabled={connect.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  connect.mutate(form, {
                    onSuccess: () => {
                      setEditing(false)
                      // Pull the first batch so the Insights tab isn't empty.
                      sync.mutate(undefined)
                    },
                  })
                }
                loading={connect.isPending || sync.isPending}
                // Ad account always required; token required only for a first connect
                // (blank keeps the saved token when re-editing a connected account).
                disabled={!form.adAccountId.trim() || (!connected && !form.accessToken.trim())}
              >
                <FacebookIcon className="mr-1.5 h-3.5 w-3.5" /> {connected ? "Save" : "Connect"}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect Meta Ads?"
        description="This removes the stored credentials and all synced campaign data for this project. You can reconnect anytime."
        variant="destructive"
        confirmLabel="Disconnect"
        isLoading={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(undefined, { onSuccess: () => setDisconnectOpen(false) })
        }
      />
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  secret,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  secret?: boolean
  className?: string
}) {
  const filled = value.trim().length > 0
  return (
    <div className={className}>
      <Label className="flex items-center gap-1.5 text-xs">
        {label}
        {required && !filled && <span className="text-destructive">*</span>}
        {filled && <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
      </Label>
      <Input
        type={secret ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
        autoComplete="off"
      />
    </div>
  )
}
