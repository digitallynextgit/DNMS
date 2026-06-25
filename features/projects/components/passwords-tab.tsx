"use client"

import { useState } from "react"
import {
  useProjectPasswords,
  useRevealPassword,
  useCreatePassword,
  useUpdatePassword,
  useDeletePassword,
  type PasswordEntry,
} from "@/features/projects/hooks/use-projects"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { formatDate } from "@/lib/utils"
import {
  Plus,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
  ExternalLink,
  KeyRound,
  Check,
} from "lucide-react"
import { toast } from "sonner"

interface Props {
  projectId: string
  currentUserId: string
  canManage: boolean
}

export function PasswordsTab({ projectId, currentUserId, canManage }: Props) {
  const { data, isLoading } = useProjectPasswords(projectId)
  const entries = data?.data ?? []
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) {
    return <ListSkeleton rows={3} height="h-20" className="space-y-3" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium">Project Credentials</p>
          {entries.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {entries.length}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Passwords are AES-256 encrypted at rest. Only team members can view entries for this
        project.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          compact
          icon={KeyRound}
          title="No credentials saved yet"
          description="Store API keys, logins, and secrets here securely."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <PasswordRow
              key={entry.id}
              entry={entry}
              projectId={projectId}
              currentUserId={currentUserId}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      <PasswordFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        mode="create"
      />
    </div>
  )
}

function PasswordRow({
  entry,
  projectId,
  currentUserId,
  canManage,
}: {
  entry: PasswordEntry
  projectId: string
  currentUserId: string
  canManage: boolean
}) {
  const reveal = useRevealPassword(projectId)
  const del = useDeletePassword(projectId)
  const [revealedPw, setRevealedPw] = useState<string | null>(null)
  const [showing, setShowing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOwner = entry.createdBy.id === currentUserId

  async function handleReveal() {
    if (revealedPw) {
      setShowing((s) => !s)
      return
    }
    reveal.mutate(entry.id, {
      onSuccess: (res) => {
        setRevealedPw(res.data.password)
        setShowing(true)
      },
    })
  }

  async function handleCopy() {
    let pw = revealedPw
    if (!pw) {
      const res = await new Promise<string | null>((resolve) => {
        reveal.mutate(entry.id, {
          onSuccess: (r) => {
            setRevealedPw(r.data.password)
            resolve(r.data.password)
          },
          onError: () => resolve(null),
        })
      })
      if (!pw) pw = res
    }
    if (pw) {
      navigator.clipboard.writeText(pw).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("Copied to clipboard")
      })
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded">
            <KeyRound className="text-primary h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{entry.label}</span>
              {entry.url && (
                <a
                  href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  {entry.url}
                </a>
              )}
            </div>

            {entry.username && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                <span className="font-medium">Username:</span> {entry.username}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2">
              <code className="bg-muted inline-block min-w-24 rounded px-2 py-0.5 font-mono text-xs">
                {showing && revealedPw ? revealedPw : "••••••••••"}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-6 w-6"
                onClick={handleReveal}
                disabled={reveal.isPending}
                title={showing ? "Hide" : "Reveal"}
              >
                {showing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-6 w-6"
                onClick={handleCopy}
                title="Copy password"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {entry.notes && (
              <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                {entry.notes}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {(isOwner || canManage) && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {(isOwner || canManage) && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t pt-2">
          <AvatarDisplay
            src={entry.createdBy.profilePhoto}
            firstName={entry.createdBy.firstName}
            lastName={entry.createdBy.lastName}
            size="xs"
            className="h-4 w-4"
          />
          <span className="text-muted-foreground text-[10px]">
            Added by {entry.createdBy.firstName} · {formatDate(entry.createdAt)}
          </span>
        </div>
      </CardContent>

      <PasswordFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectId={projectId}
        mode="edit"
        entry={entry}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete credential"
        description={`Delete "${entry.label}"?`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(entry.id, { onSuccess: () => setConfirmOpen(false) })}
      />
    </Card>
  )
}

function PasswordFormDialog({
  open,
  onClose,
  projectId,
  mode,
  entry,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  mode: "create" | "edit"
  entry?: PasswordEntry
}) {
  const [label, setLabel] = useState(entry?.label ?? "")
  const [username, setUsername] = useState(entry?.username ?? "")
  const [password, setPassword] = useState("")
  const [url, setUrl] = useState(entry?.url ?? "")
  const [notes, setNotes] = useState(entry?.notes ?? "")
  const [showPw, setShowPw] = useState(false)
  const create = useCreatePassword(projectId)
  const update = useUpdatePassword(projectId)
  const pending = create.isPending || update.isPending

  function handleSubmit() {
    if (!label.trim()) return
    if (mode === "create") {
      if (!password.trim()) return
      create.mutate(
        {
          label: label.trim(),
          password: password.trim(),
          username: username.trim() || undefined,
          url: url.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        {
          onSuccess: () => {
            resetForm()
            onClose()
          },
        },
      )
    } else if (entry) {
      const body: Record<string, string> = {}
      if (label.trim() !== entry.label) body.label = label.trim()
      if (username.trim() !== (entry.username ?? "")) body.username = username.trim()
      if (password.trim()) body.password = password.trim()
      if (url.trim() !== (entry.url ?? "")) body.url = url.trim()
      if (notes.trim() !== (entry.notes ?? "")) body.notes = notes.trim()
      update.mutate({ entryId: entry.id, body }, { onSuccess: () => onClose() })
    }
  }

  function resetForm() {
    setLabel("")
    setUsername("")
    setPassword("")
    setUrl("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Credential" : "Edit Credential"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Label *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production DB, AWS Root, Figma Team"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Username / Email</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{mode === "edit" ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "edit" ? "Leave blank to keep" : "Enter password"}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!label.trim() || (mode === "create" && !password.trim()) || pending}
          >
            {pending ? "Saving…" : mode === "create" ? "Save" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
