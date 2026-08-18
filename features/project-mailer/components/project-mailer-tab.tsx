"use client"

/**
 * Project → Mailer tab.
 *
 * Per-project outbound email: the client's OWN SMTP account, their templates,
 * their recipient list, and bulk campaigns. Sending from the client's domain
 * rather than ours is the point - a client newsletter from
 * noreply@digitallynext.com reads as spam to their subscribers and burns our
 * sending reputation when it bounces.
 *
 * Sending is queued server-side, so "Send" returns instantly and the campaign
 * row shows live progress.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Pencil,
  Send,
  Server,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Ban,
  MailCheck,
  Clock,
  FileSpreadsheet,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BodyComposer, type BodyMode } from "./body-composer"
import { RecipientImportDialog } from "./recipient-import-dialog"
import { CampaignHistoryDialog } from "./campaign-history-dialog"
import { buildVars, extractVars } from "../lib/merge"
import { estimateCampaign, formatDuration, TICK_SECONDS } from "../lib/eta"

// ─── Types ──────────────────────────────────────────────────────────────────

interface MailerSettings {
  id: string
  name: string
  fromName: string
  fromEmail: string
  replyTo: string | null
  host: string
  port: number
  secure: boolean
  username: string
  isActive: boolean
  lastVerifiedAt: string | null
  lastError: string | null
}

interface Template {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyMode: BodyMode
  isActive: boolean
  updatedAt: string
}

interface Recipient {
  id: string
  email: string
  name: string | null
  company: string | null
  tags: string[]
  fields: Record<string, unknown> | null
  isSubscribed: boolean
}

interface Campaign {
  id: string
  name: string
  subject: string
  status: "DRAFT" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED"
  totalCount: number
  sentCount: number
  failedCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  createdBy: { firstName: string; lastName: string } | null
  mailer: { id: string; name: string; fromEmail: string } | null
}

interface MailerOverview {
  mailers: MailerSettings[]
  templates: Template[]
  recipients: Recipient[]
  campaigns: Campaign[]
  subscribedCount: number
  /** Total on the list. `recipients` above is capped, so this is the real size. */
  recipientCount: number
  allTags: string[]
  /** Segment sizes counted server-side over the whole list, not the loaded page. */
  tagCounts: { tag: string; count: number }[]
  untaggedCount: number
}

const STATUS_TONE: Record<Campaign["status"], string> = {
  DRAFT: "bg-muted text-muted-foreground",
  QUEUED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  SENDING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  SENT: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
}

// ─── Root ───────────────────────────────────────────────────────────────────

export function ProjectMailerTab({
  projectRef,
  canManage,
}: {
  projectRef: string
  canManage: boolean
}) {
  const base = `/api/projects/${projectRef}/mailer`

  const { data, isPending, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["project-mailer", projectRef],
    queryFn: async () => (await apiFetch<{ data: { data: MailerOverview } }>(base)).data.data,
    enabled: canManage,
    // Campaigns drain on a 30s server tick. Poll fast only while something is
    // actually in flight - a 5s poll on a settled list is pure load for nothing.
    refetchInterval: (q) =>
      (q.state.data?.campaigns ?? []).some((c) => c.status === "QUEUED" || c.status === "SENDING")
        ? 5_000
        : 60_000,
    // React Query stops polling on a blurred tab by default, which is exactly how
    // a campaign that finished in 60s could still read "QUEUED · 0 sent" minutes
    // later: you queue it, switch away, and come back to a card frozen at the
    // moment you left. Progress must keep arriving while you are elsewhere.
    refetchIntervalInBackground: true,
  })

  // Every custom key present on the recipient list, so the editors can offer
  // them - a template is NOT limited to these, they are just the ones we know
  // will resolve. Above the early return: hooks must not be conditional.
  const customVars = React.useMemo(() => {
    const keys = new Set<string>()
    for (const r of data?.recipients ?? []) {
      if (r.fields && typeof r.fields === "object") {
        for (const k of Object.keys(r.fields)) keys.add(k)
      }
    }
    return [...keys].sort()
  }, [data?.recipients])

  /**
   * Uploads an image and returns the PUBLIC url to embed. Defined here so the
   * template editor and the campaign composer share one implementation - and
   * above the early return, because hooks must not be conditional.
   */
  const uploadImage = React.useCallback(
    async (file: File): Promise<string> => {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`${base}/images`, { method: "POST", body })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Upload failed")
      return json.data.url as string
    },
    [base],
  )

  /**
   * Reclaim an image's stored file after it is removed from a body. The asset id
   * is the last segment of the public url we minted at upload time.
   *
   * Best-effort and non-blocking: the image is already out of the document, so a
   * failure here costs a stranded file, not a broken email. A 409 means the file
   * was deliberately kept because a sent campaign still points at it - worth
   * saying out loud rather than swallowing.
   */
  const deleteImage = React.useCallback(
    (src: string) => {
      const assetId = src.split("/").pop()?.split("?")[0]
      if (!assetId) return
      void fetch(`${base}/images/${assetId}`, { method: "DELETE" })
        .then(async (res) => {
          if (res.status === 409) {
            const json = await res.json().catch(() => null)
            toast.info(json?.error?.message ?? json?.error ?? "The file was kept.")
          }
        })
        .catch(() => {
          /* stranded file; the Storage screen lists orphans */
        })
    },
    [base],
  )

  if (!canManage) {
    return (
      <EmptyState
        icon={Server}
        title="Not available"
        description="Only the Account Manager or a project admin can manage the mailer."
        variant="card"
      />
    )
  }

  const onDone = () => void refetch()

  return (
    <Tabs defaultValue="campaigns" className="space-y-4">
      <TabsList>
        <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
          <Send className="h-3.5 w-3.5" />
          Campaigns
        </TabsTrigger>
        <TabsTrigger value="templates" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          Templates
        </TabsTrigger>
        <TabsTrigger value="recipients" className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" />
          Recipients
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-1.5 text-xs">
          <Server className="h-3.5 w-3.5" />
          Accounts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="campaigns">
        <CampaignsSection
          base={base}
          data={data}
          customVars={customVars}
          onUploadImage={uploadImage}
          onDeleteImage={deleteImage}
          isPending={isPending}
          dataUpdatedAt={dataUpdatedAt}
          onDone={onDone}
        />
      </TabsContent>
      <TabsContent value="templates">
        <TemplatesSection
          base={base}
          templates={data?.templates ?? []}
          customVars={customVars}
          onUploadImage={uploadImage}
          onDeleteImage={deleteImage}
          isPending={isPending}
          onDone={onDone}
        />
      </TabsContent>
      <TabsContent value="recipients">
        <RecipientsSection
          base={base}
          recipients={data?.recipients ?? []}
          subscribedCount={data?.subscribedCount ?? 0}
          recipientCount={data?.recipientCount ?? 0}
          allTags={data?.allTags ?? []}
          tagCounts={data?.tagCounts ?? []}
          untaggedCount={data?.untaggedCount ?? 0}
          isPending={isPending}
          onDone={onDone}
        />
      </TabsContent>
      <TabsContent value="settings">
        <AccountsSection
          base={base}
          mailers={data?.mailers ?? []}
          isPending={isPending}
          onDone={onDone}
        />
      </TabsContent>
    </Tabs>
  )
}

// ─── SMTP accounts ──────────────────────────────────────────────────────────

function AccountsSection({
  base,
  mailers,
  isPending,
  onDone,
}: {
  base: string
  mailers: MailerSettings[]
  isPending: boolean
  onDone: () => void
}) {
  const [editing, setEditing] = React.useState<MailerSettings | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<MailerSettings | null>(null)
  const [testing, setTesting] = React.useState<MailerSettings | null>(null)
  const [testTo, setTestTo] = React.useState("")

  const remove = useMutation({
    mutationFn: (m: MailerSettings) => apiFetch(`${base}/accounts/${m.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Account removed")
      setRemoving(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const test = useMutation({
    mutationFn: (m: MailerSettings) =>
      apiFetch(`${base}/accounts/${m.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      }),
    onSuccess: () => {
      toast.success("Test email sent - check the inbox")
      setTesting(null)
      onDone()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      onDone()
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          A project can hold several sending accounts - a campaign picks which one to send from.
        </p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add account
        </Button>
      </div>

      {isPending && <Skeleton className="h-24 rounded-sm" />}

      {!isPending && mailers.length === 0 && (
        <EmptyState
          icon={Server}
          title="No sending accounts yet"
          description="Add the client's SMTP details so campaigns go out from their own domain."
          variant="card"
        />
      )}

      <div className="space-y-2">
        {mailers.map((m) => (
          <div key={m.id} className="bg-card rounded-sm border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{m.name}</p>
                  {!m.isActive && (
                    <Badge variant="secondary" className="text-[10px]">
                      Off
                    </Badge>
                  )}
                  {/* Credentials are proven, known-broken, or untested - say which
                      rather than just showing that the fields are filled in. */}
                  {m.lastVerifiedAt ? (
                    <Badge className="bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  ) : m.lastError ? (
                    <Badge className="bg-destructive/10 text-destructive text-[10px]">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Failing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Untested
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {m.fromName} &lt;{m.fromEmail}&gt;
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {m.host}:{m.port}
                  {m.secure ? " · SSL" : " · STARTTLS"} · {m.username}
                  {m.lastVerifiedAt &&
                    ` · verified ${new Date(m.lastVerifiedAt).toLocaleDateString()}`}
                </p>
                {m.lastError && (
                  <p className="text-destructive text-[11px]">Last error: {m.lastError}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setTestTo("")
                    setTesting(m)
                  }}
                >
                  <MailCheck className="h-3.5 w-3.5" />
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setEditing(m)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-8 px-2"
                  onClick={() => setRemoving(m)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AccountDialog
        base={base}
        mailer={editing}
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false)
            setEditing(null)
          }
        }}
        onDone={onDone}
      />

      {/* Test send */}
      <Dialog open={!!testing} onOpenChange={(o) => !o && setTesting(null)}>
        <DialogContent className="max-w-md lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Send a test email</DialogTitle>
            <DialogDescription className="text-xs">
              Authenticates against {testing?.host} and delivers a real message from{" "}
              {testing?.fromEmail}.
            </DialogDescription>
          </DialogHeader>
          <FormRow label="Send to" required>
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@digitallynext.com"
              className="h-9 text-sm"
            />
          </FormRow>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setTesting(null)}>
              Cancel
            </Button>
            <Button
              className="h-9 text-xs"
              disabled={!/\S+@\S+\.\S+/.test(testTo) || test.isPending}
              loading={test.isPending}
              onClick={() => testing && test.mutate(testing)}
            >
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this account?"
        description={
          removing
            ? `"${removing.name}" is deleted. Past campaigns keep their history but will no longer name a live account.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

function AccountDialog({
  base,
  mailer,
  open,
  onOpenChange,
  onDone,
}: {
  base: string
  mailer: MailerSettings | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const isEdit = !!mailer
  const [form, setForm] = React.useState({
    name: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    isActive: true,
  })

  React.useEffect(() => {
    if (!open) return
    setForm({
      name: mailer?.name ?? "",
      fromName: mailer?.fromName ?? "",
      fromEmail: mailer?.fromEmail ?? "",
      replyTo: mailer?.replyTo ?? "",
      host: mailer?.host ?? "",
      port: mailer?.port ?? 587,
      secure: mailer?.secure ?? false,
      username: mailer?.username ?? "",
      // Never populated from the server - blank means "keep the stored one".
      password: "",
      isActive: mailer?.isActive ?? true,
    })
  }, [open, mailer])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      const init = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
      return isEdit
        ? apiFetch(`${base}/accounts/${mailer!.id}`, { method: "PATCH", ...init })
        : apiFetch(`${base}/accounts`, { method: "POST", ...init })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Account updated" : "Account added")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid =
    form.name.trim().length >= 2 &&
    form.fromName.trim() &&
    /\S+@\S+\.\S+/.test(form.fromEmail) &&
    form.host.trim() &&
    form.username.trim() &&
    (isEdit || form.password)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? `Edit ${mailer!.name}` : "Add a sending account"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Campaigns choose which account to send from, so a newsletter and transactional mail can
            use different domains.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormRow label="Account name" required hint='Shown in the "Send from" picker.'>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Newsletter"
              className="h-9 text-sm"
            />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Sender name" required>
              <Input
                value={form.fromName}
                onChange={(e) => set("fromName", e.target.value)}
                placeholder="Acme Marketing"
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow label="Sender email" required hint="Must belong to the SMTP account's domain.">
              <Input
                type="email"
                value={form.fromEmail}
                onChange={(e) => set("fromEmail", e.target.value)}
                placeholder="hello@acme.com"
                className="h-9 text-sm"
              />
            </FormRow>
          </div>

          <FormRow label="Reply-to" hint="Where replies go, if not the sender address.">
            <Input
              type="email"
              value={form.replyTo}
              onChange={(e) => set("replyTo", e.target.value)}
              className="h-9 text-sm"
            />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="SMTP host" required>
              <Input
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                placeholder="smtp.gmail.com"
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow label="Port" required hint="587 = STARTTLS, 465 = SSL.">
              <Input
                type="number"
                value={form.port}
                onChange={(e) => set("port", Number(e.target.value))}
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow label="SSL" hint="On for 465, off for 587.">
              <div className="flex h-9 items-center">
                <Switch checked={form.secure} onCheckedChange={(v) => set("secure", v)} />
              </div>
            </FormRow>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Username" required>
              <Input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow
              label="Password"
              required={!isEdit}
              hint={isEdit ? "Leave blank to keep the saved password." : "Stored encrypted."}
            >
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={isEdit ? "••••••••" : ""}
                className="h-9 text-sm"
              />
            </FormRow>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            <span className="text-xs font-medium">
              Active
              <span className="text-muted-foreground ml-1 font-normal">
                - campaigns can&apos;t be queued on an inactive account
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={!valid || save.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {isEdit ? "Save" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Templates ──────────────────────────────────────────────────────────────

function TemplatesSection({
  base,
  templates,
  customVars,
  onUploadImage,
  onDeleteImage,
  isPending,
  onDone,
}: {
  base: string
  templates: Template[]
  customVars: string[]
  onUploadImage: (file: File) => Promise<string>
  onDeleteImage: (src: string) => void
  isPending: boolean
  onDone: () => void
}) {
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<Template | null>(null)

  const remove = useMutation({
    mutationFn: (t: Template) => apiFetch(`${base}/templates/${t.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Template deleted")
      setRemoving(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Reusable bodies. Any <span className="font-mono">{"{{variable}}"}</span> is substituted
          per recipient.
        </p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          New template
        </Button>
      </div>

      {isPending && <Skeleton className="h-20 rounded-sm" />}

      {!isPending && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create one so campaigns don't start from a blank page every time."
          variant="card"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="bg-card rounded-sm border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-muted-foreground truncate text-xs">{t.subject}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${t.name}`}
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => setRemoving(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-[11px]">
              Updated {new Date(t.updatedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      <TemplateDialog
        base={base}
        template={editing}
        customVars={customVars}
        onUploadImage={onUploadImage}
        onDeleteImage={onDeleteImage}
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false)
            setEditing(null)
          }
        }}
        onDone={onDone}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this template?"
        description={
          removing
            ? `"${removing.name}" is removed. Campaigns already sent from it are unaffected.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

function TemplateDialog({
  base,
  template,
  customVars,
  onUploadImage,
  onDeleteImage,
  open,
  onOpenChange,
  onDone,
}: {
  base: string
  template: Template | null
  customVars: string[]
  onUploadImage: (file: File) => Promise<string>
  onDeleteImage: (src: string) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const isEdit = !!template
  const [form, setForm] = React.useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyMode: "RICH" as BodyMode,
    isActive: true,
  })

  React.useEffect(() => {
    if (!open) return
    setForm({
      name: template?.name ?? "",
      subject: template?.subject ?? "",
      bodyHtml: template?.bodyHtml ?? "",
      bodyMode: template?.bodyMode ?? "RICH",
      isActive: template?.isActive ?? true,
    })
  }, [open, template])

  const save = useMutation({
    mutationFn: () => {
      const init = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
      return isEdit
        ? apiFetch(`${base}/templates/${template!.id}`, { method: "PATCH", ...init })
        : apiFetch(`${base}/templates`, { method: "POST", ...init })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Template updated" : "Template created")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid =
    form.name.trim().length >= 2 && form.subject.trim() && form.bodyHtml.trim().length > 9

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? `Edit ${template!.name}` : "New template"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Write it in the editor or in raw HTML - both send as HTML. The preview updates as you
            type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormRow label="Name" required hint="Internal only - never shown to recipients.">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="August newsletter"
              className="h-9 max-w-sm text-sm"
            />
          </FormRow>

          <BodyComposer
            subject={form.subject}
            onSubjectChange={(v) => setForm((f) => ({ ...f, subject: v }))}
            bodyHtml={form.bodyHtml}
            onBodyChange={(v) => setForm((f) => ({ ...f, bodyHtml: v }))}
            mode={form.bodyMode}
            onModeChange={(m) => setForm((f) => ({ ...f, bodyMode: m }))}
            customVars={customVars}
            onUploadImage={onUploadImage}
            onDeleteImage={onDeleteImage}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={!valid || save.isPending}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Recipients ─────────────────────────────────────────────────────────────

/** Sentinel tag filters. Real tags are their own string. */
const TAG_ALL = "__all__"
const TAG_UNTAGGED = "__untagged__"

/** One segment in the tag strip: name plus how many people are in it. */
function TagChip({
  label,
  count,
  active,
  muted,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground",
        muted && !active && "border-dashed",
      )}
    >
      <span className={cn(!muted && "font-medium")}>{label}</span>
      <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>{count}</span>
    </button>
  )
}

function RecipientsSection({
  base,
  recipients,
  subscribedCount,
  recipientCount,
  allTags,
  tagCounts,
  untaggedCount,
  isPending,
  onDone,
}: {
  base: string
  recipients: Recipient[]
  subscribedCount: number
  recipientCount: number
  allTags: string[]
  tagCounts: { tag: string; count: number }[]
  untaggedCount: number
  isPending: boolean
  onDone: () => void
}) {
  const [importOpen, setImportOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [removing, setRemoving] = React.useState<Recipient | null>(null)
  const [search, setSearch] = React.useState("")
  const [tag, setTag] = React.useState<string>(TAG_ALL)

  // Only the loaded page is here, so the table can filter but the CHIP COUNTS
  // come from the server - see tagCounts.
  const loadedAll = recipients.length >= recipientCount

  // Lowercased so the import dialog can tell new addresses from existing ones
  // before it writes anything. Only trustworthy when the whole list is loaded,
  // which is why the dialog is told either way rather than guessing.
  const existingEmails = React.useMemo(
    () => new Set(recipients.map((r) => r.email.toLowerCase())),
    [recipients],
  )

  const toggle = useMutation({
    mutationFn: (r: Recipient) =>
      apiFetch(`${base}/recipients/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSubscribed: !r.isSubscribed }),
      }),
    onSuccess: (_d, r) => {
      toast.success(r.isSubscribed ? "Unsubscribed" : "Resubscribed")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (r: Recipient) => apiFetch(`${base}/recipients/${r.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Recipient removed")
      setRemoving(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipients.filter((r) => {
      if (tag === TAG_UNTAGGED && r.tags.length > 0) return false
      if (tag !== TAG_ALL && tag !== TAG_UNTAGGED && !r.tags.includes(tag)) return false
      if (!q) return true
      return r.email.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q)
    })
  }, [recipients, search, tag])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground">{subscribedCount}</strong> subscribed of{" "}
          {recipientCount} on the list.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setSheetOpen(true)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Upload sheet
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add recipients
          </Button>
        </div>
      </div>

      {/* Segments, with their real sizes. Doubles as the answer to "who is in
          this tag?" - the same tag names a campaign targets. */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <TagChip
            label="All"
            count={recipientCount}
            active={tag === TAG_ALL}
            onClick={() => setTag(TAG_ALL)}
          />
          {tagCounts.map((t) => (
            <TagChip
              key={t.tag}
              label={t.tag}
              count={t.count}
              active={tag === t.tag}
              onClick={() => setTag(tag === t.tag ? TAG_ALL : t.tag)}
            />
          ))}
          {untaggedCount > 0 && (
            <TagChip
              label="Untagged"
              count={untaggedCount}
              muted
              active={tag === TAG_UNTAGGED}
              onClick={() => setTag(tag === TAG_UNTAGGED ? TAG_ALL : TAG_UNTAGGED)}
            />
          )}
        </div>
      )}

      {recipients.length > 0 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="h-9 max-w-xs text-sm"
        />
      )}

      {/* A filter that matches nothing must say so - an empty table under an
          active chip otherwise reads as "the import failed". */}
      {!isPending && recipients.length > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground rounded-sm border border-dashed p-3 text-xs">
          Nobody matches {tag !== TAG_ALL && <>this segment</>}
          {tag !== TAG_ALL && search.trim() && " and "}
          {search.trim() && <>“{search.trim()}”</>}.
        </p>
      )}

      {isPending && <Skeleton className="h-20 rounded-sm" />}

      {!isPending && recipients.length === 0 && (
        <EmptyState
          icon={Users}
          title="No recipients yet"
          description="Paste a list of addresses to get started."
          variant="card"
        />
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Tags</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Subscribed</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2.5 text-xs">{r.email}</td>
                  <td className="text-muted-foreground px-3 py-2.5 text-xs">{r.name ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch checked={r.isSubscribed} onCheckedChange={() => toggle.mutate(r)} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${r.email}`}
                      onClick={() => setRemoving(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(filtered.length > 200 || !loadedAll) && (
            <p className="text-muted-foreground border-t px-3 py-2 text-[11px]">
              Showing {Math.min(filtered.length, 200)} of {filtered.length} loaded
              {!loadedAll && ` · ${recipientCount} on the list in total`}. Narrow with search or a
              segment.
            </p>
          )}
        </div>
      )}

      <ImportDialog
        base={base}
        open={importOpen}
        onOpenChange={setImportOpen}
        allTags={allTags}
        onDone={onDone}
      />

      <RecipientImportDialog
        base={base}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allTags={allTags}
        existingEmails={existingEmails}
        knowsWholeList={loadedAll}
        onDone={onDone}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this recipient?"
        description={
          removing
            ? `${removing.email} is deleted from the list. Unsubscribing instead keeps the record and stops future sends.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

function ImportDialog({
  base,
  open,
  onOpenChange,
  allTags,
  onDone,
}: {
  base: string
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Tags already in use on this project, offered as one-click choices. */
  allTags: string[]
  onDone: () => void
}) {
  const [raw, setRaw] = React.useState("")
  const [tags, setTags] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setRaw("")
      setTags("")
    }
  }, [open])

  // Parsed once here rather than again at submit, so the chips below and the
  // request can never disagree about what was typed.
  const selectedTags = React.useMemo(
    () =>
      tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tags],
  )

  /** Append an existing tag, keeping the field's comma-separated shape. */
  function addTag(t: string) {
    if (selectedTags.includes(t)) return
    setTags((prev) => (prev.trim() ? `${prev.replace(/[,\s]*$/, "")}, ${t}` : t))
  }

  const unusedTags = allTags.filter((t) => !selectedTags.includes(t))

  const add = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { data: { parsed: number; added: number; skipped: number } } }>(
        `${base}/recipients/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw, tags: selectedTags }),
        },
      ),
    onSuccess: (res) => {
      const r = res?.data?.data
      toast.success(
        r
          ? `Added ${r.added}${r.skipped ? `, skipped ${r.skipped} already on the list` : ""}`
          : "Added",
      )
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Add recipients</DialogTitle>
          <DialogDescription className="text-xs">
            One per line. Plain addresses, “Name &lt;email&gt;” or “Name, email” all work.
            Duplicates are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormRow label="Addresses" required>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={10}
              placeholder={
                "priya@example.com\nRahul Verma <rahul@example.com>\nAsha, asha@example.com"
              }
              className="font-mono text-xs"
            />
          </FormRow>
          <FormRow label="Tags" hint="Comma-separated. Lets a campaign target a segment.">
            <div className="space-y-2">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="newsletter, vip"
                className="h-9 text-sm"
              />
              {/* The tags this project already uses. Typing one by hand risks a
                  near-miss ("Customer" vs "Customers") that silently creates a
                  second segment nobody notices until a campaign misses half its
                  audience. */}
              {unusedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">Existing:</span>
                  {unusedTags.slice(0, 10).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => addTag(t)}
                    >
                      + {t}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </FormRow>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={raw.trim().length < 3 || add.isPending}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Add to list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

/**
 * A clock that only runs when something is waiting on it.
 *
 * The queue is polled every 5s, but a countdown that only moved every 5s reads
 * as frozen - which is the exact impression we are trying to fix. This ticks the
 * display each second between polls; the polls re-anchor it to server truth.
 */
function useTicker(active: boolean, everyMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [active, everyMs])
  return now
}

/**
 * "How much longer?" for a campaign in flight.
 *
 * The estimate is anchored to `dataUpdatedAt` rather than recomputed from the
 * counts alone: between two polls the sent count is frozen, so a naive estimate
 * would sit motionless for five seconds at a time. Subtracting the time since
 * the fetch makes it fall smoothly and snap back to the truth on every poll.
 */
function CampaignTimer({
  campaign,
  now,
  dataUpdatedAt,
}: {
  campaign: Campaign
  now: number
  dataUpdatedAt: number
}) {
  const eta = estimateCampaign(campaign, dataUpdatedAt || now)
  if (!eta) return null

  const sinceFetch = Math.max(0, (now - (dataUpdatedAt || now)) / 1000)
  const left = Math.max(0, eta.seconds - sinceFetch)

  // While QUEUED the scheduler could fire a second from now or thirty seconds
  // from now, so we show the window instead of inventing a precise moment.
  const queued = campaign.status === "QUEUED"
  const untilPickup = queued
    ? Math.max(0, TICK_SECONDS - (now - new Date(campaign.createdAt).getTime()) / 1000)
    : 0

  return (
    <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-1.5 text-[11px]">
      <Clock className="h-3 w-3 shrink-0" />
      {queued ? (
        <span>
          {untilPickup > 0 ? `Starts in ~${formatDuration(untilPickup)}` : "Starting any moment"} ·
          about {formatDuration(left)} to send {eta.remaining}
        </span>
      ) : (
        <span>
          {left > 0 ? `About ${formatDuration(left)} left` : "Finishing up"} · {eta.remaining} to go
        </span>
      )}
      <span className="opacity-70">
        ({eta.measured ? "" : "about "}
        {eta.secondsPerEmail.toFixed(1)}s per email, sent one at a time)
      </span>
    </p>
  )
}

function CampaignsSection({
  base,
  data,
  customVars,
  onUploadImage,
  onDeleteImage,
  isPending,
  dataUpdatedAt,
  onDone,
}: {
  base: string
  data?: MailerOverview
  customVars: string[]
  onUploadImage: (file: File) => Promise<string>
  onDeleteImage: (src: string) => void
  isPending: boolean
  /** When the counts below were last fetched, so the countdown can tick between polls. */
  dataUpdatedAt: number
  onDone: () => void
}) {
  const [composeOpen, setComposeOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState<Campaign | null>(null)
  const [deleting, setDeleting] = React.useState<Campaign | null>(null)
  const [viewing, setViewing] = React.useState<Campaign | null>(null)

  const campaigns = data?.campaigns ?? []
  const anyLive = campaigns.some((c) => c.status === "QUEUED" || c.status === "SENDING")
  const now = useTicker(anyLive)
  const activeMailers = (data?.mailers ?? []).filter((m) => m.isActive)
  const ready = activeMailers.length > 0 && (data?.subscribedCount ?? 0) > 0

  const cancel = useMutation({
    mutationFn: (c: Campaign) => apiFetch(`${base}/campaigns/${c.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Campaign cancelled")
      setCancelling(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // `purge=1` is what separates "remove this record" from "stop this send" - see
  // the route. Same verb, different intent, stated rather than inferred.
  const remove = useMutation({
    mutationFn: (c: Campaign) =>
      apiFetch(`${base}/campaigns/${c.id}?purge=1`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Campaign deleted")
      setDeleting(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Every recipient gets their own separate email - nobody sees anyone else&apos;s address.
          Sending drains in the background, so you can close this tab.
        </p>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={!ready}
          onClick={() => setComposeOpen(true)}
        >
          <Send className="h-3.5 w-3.5" />
          New campaign
        </Button>
      </div>

      {/* Say exactly what is missing rather than leaving the button dead. */}
      {!ready && !isPending && (
        <div className="text-muted-foreground rounded-sm border border-dashed p-3 text-xs">
          {(data?.mailers.length ?? 0) === 0
            ? "Add a sending account first - see the Accounts tab."
            : activeMailers.length === 0
              ? "Every sending account is switched off - turn one on in the Accounts tab."
              : "No subscribed recipients yet - add some in the Recipients tab."}
        </div>
      )}

      {isPending && <Skeleton className="h-20 rounded-sm" />}

      {!isPending && campaigns.length === 0 && (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          description="Compose one and it goes out from this project's own address."
          variant="card"
        />
      )}

      <div className="space-y-2">
        {campaigns.map((c) => {
          const done = c.sentCount + c.failedCount
          const pct = c.totalCount ? Math.round((done / c.totalCount) * 100) : 0
          const live = c.status === "QUEUED" || c.status === "SENDING"
          return (
            <div key={c.id} className="bg-card rounded-sm border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* The whole block opens the per-recipient history: the card
                    already shows the summary, so "who exactly got it" is the
                    obvious next question to answer on click. */}
                <button
                  type="button"
                  className="min-w-0 cursor-pointer text-left"
                  onClick={() => setViewing(c)}
                  aria-label={`Who received ${c.name}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium hover:underline">{c.name}</p>
                    <Badge className={cn("text-[10px]", STATUS_TONE[c.status])}>{c.status}</Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">{c.subject}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {c.sentCount} sent
                    {c.failedCount > 0 && ` · ${c.failedCount} failed`} of {c.totalCount}
                    {c.mailer && ` · via ${c.mailer.name}`}
                    {c.createdBy && ` · ${c.createdBy.firstName} ${c.createdBy.lastName}`}
                  </p>
                  <p className="text-primary mt-1 text-[11px]">See who received it →</p>
                </button>
                {live ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-8 gap-1.5 text-xs"
                    onClick={() => setCancelling(c)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                ) : (
                  // Finished campaigns only. A test send is clutter; there was
                  // previously no way to clear one without a database query.
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${c.name}`}
                    title="Delete this campaign"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {c.totalCount > 0 && (c.status !== "SENT" || c.failedCount > 0) && (
                <Progress value={pct} className="mt-3 h-1.5" />
              )}
              {live && <CampaignTimer campaign={c} now={now} dataUpdatedAt={dataUpdatedAt} />}
            </div>
          )
        })}
      </div>

      <ComposeDialog
        base={base}
        data={data}
        customVars={customVars}
        onUploadImage={onUploadImage}
        onDeleteImage={onDeleteImage}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onDone={onDone}
      />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this campaign?"
        description={
          cancelling
            ? `Anything not yet sent is dropped. The ${cancelling.sentCount} email(s) already delivered cannot be recalled.`
            : ""
        }
        confirmLabel="Cancel campaign"
        variant="destructive"
        isLoading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this campaign?"
        description={
          deleting
            ? `"${deleting.name}" and its record of who received it are removed for good. The ${deleting.sentCount} email(s) already delivered are unaffected - this only clears the history here.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />

      <CampaignHistoryDialog
        base={base}
        campaign={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
      />
    </div>
  )
}

function ComposeDialog({
  base,
  data,
  customVars,
  onUploadImage,
  onDeleteImage,
  open,
  onOpenChange,
  onDone,
}: {
  base: string
  data?: MailerOverview
  customVars: string[]
  onUploadImage: (file: File) => Promise<string>
  onDeleteImage: (src: string) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const activeMailers = React.useMemo(
    () => (data?.mailers ?? []).filter((m) => m.isActive),
    [data?.mailers],
  )

  const [form, setForm] = React.useState({
    mailerId: "",
    name: "",
    subject: "",
    bodyHtml: "",
    bodyMode: "RICH" as BodyMode,
    templateId: "",
    tags: [] as string[],
  })

  React.useEffect(() => {
    if (!open) return
    // Pre-select when there is only one real choice; otherwise make them pick,
    // because sending from the wrong domain is not a recoverable mistake.
    setForm({
      mailerId: activeMailers.length === 1 ? activeMailers[0]!.id : "",
      name: "",
      subject: "",
      bodyHtml: "",
      bodyMode: "RICH",
      templateId: "",
      tags: [],
    })
  }, [open, activeMailers])

  // Choosing a template copies its content in rather than referencing it: the
  // campaign keeps what was actually sent, so editing the template later never
  // rewrites history.
  function applyTemplate(id: string) {
    const t = data?.templates.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      templateId: id,
      subject: t?.subject ?? f.subject,
      bodyHtml: t?.bodyHtml ?? f.bodyHtml,
      bodyMode: t?.bodyMode ?? f.bodyMode,
      name: f.name || (t?.name ?? ""),
    }))
  }

  // Preview headers show the account actually selected, so the From line in the
  // preview is the one that will be used.
  const selectedMailer = activeMailers.find((m) => m.id === form.mailerId)

  const audience = React.useMemo(() => {
    const subs = (data?.recipients ?? []).filter((r) => r.isSubscribed)
    return form.tags.length ? subs.filter((r) => r.tags.some((t) => form.tags.includes(t))) : subs
  }, [data?.recipients, form.tags])

  const send = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Campaign queued - sending starts within 30 seconds")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid =
    // An account must be chosen: sending from the wrong domain is not a
    // recoverable mistake, so there is no implicit fallback.
    !!form.mailerId &&
    form.name.trim().length >= 2 &&
    form.subject.trim().length >= 2 &&
    form.bodyHtml.trim().length > 9 &&
    audience.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-sm">New campaign</DialogTitle>
          <DialogDescription className="text-xs">
            Queued, not sent immediately - you can close the tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormRow label="Send from" required hint="Which SMTP account this goes out through.">
            <Select
              value={form.mailerId}
              onValueChange={(v) => setForm((f) => ({ ...f, mailerId: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {activeMailers.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-sm">
                    {m.name} - {m.fromEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Campaign name" required hint="Internal only.">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow label="Start from a template">
              <Select value={form.templateId} onValueChange={applyTemplate}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Blank" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          </div>

          <BodyComposer
            subject={form.subject}
            onSubjectChange={(v) => setForm((f) => ({ ...f, subject: v }))}
            bodyHtml={form.bodyHtml}
            onBodyChange={(v) => setForm((f) => ({ ...f, bodyHtml: v }))}
            mode={form.bodyMode}
            onModeChange={(m) => setForm((f) => ({ ...f, bodyMode: m }))}
            customVars={customVars}
            onUploadImage={onUploadImage}
            onDeleteImage={onDeleteImage}
            fromName={selectedMailer?.fromName}
            fromEmail={selectedMailer?.fromEmail}
          />

          {(data?.allTags.length ?? 0) > 0 && (
            <FormRow label="Send to" hint="No tag selected = everyone subscribed.">
              <div className="flex flex-wrap gap-2">
                {data!.allTags.map((tag) => (
                  <label
                    key={tag}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs transition-colors",
                      form.tags.includes(tag) ? "border-foreground/30 bg-muted/40" : "",
                    )}
                  >
                    <Checkbox
                      checked={form.tags.includes(tag)}
                      onCheckedChange={() =>
                        setForm((f) => ({
                          ...f,
                          tags: f.tags.includes(tag)
                            ? f.tags.filter((t) => t !== tag)
                            : [...f.tags, tag],
                        }))
                      }
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </FormRow>
          )}

          <div className="bg-muted/40 rounded-sm border p-3 text-xs">
            This will send to <strong>{audience.length}</strong> subscribed recipient
            {audience.length === 1 ? "" : "s"}.
            {audience.length === 0 && " Nothing matches - adjust the tags."}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 gap-1.5 text-xs"
            disabled={!valid || send.isPending}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            <Send className="h-3.5 w-3.5" />
            Queue for {audience.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function FormRow({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  )
}
