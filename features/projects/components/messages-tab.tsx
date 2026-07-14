"use client"

import { useState } from "react"
import {
  useProjectMessages,
  useCreateMessage,
  useUpdateMessage,
  useDeleteMessage,
  type ProjectMessage,
} from "@/features/projects/hooks/use-projects"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { Pin, PinOff, Plus, Trash2, Pencil, MessageSquare } from "lucide-react"

interface Props {
  projectId: string
  currentUserId: string
  canManage: boolean
}

export function MessagesTab({ projectId, currentUserId, canManage }: Props) {
  const { data, isLoading } = useProjectMessages(projectId)
  const messages = data?.data ?? []
  const [composeOpen, setComposeOpen] = useState(false)

  if (isLoading) {
    return <ListSkeleton rows={3} height="h-28" className="space-y-3" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Message
        </Button>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="No messages yet"
          description="Post an update, decision, or announcement for the team."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              projectId={projectId}
              currentUserId={currentUserId}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        projectId={projectId}
      />
    </div>
  )
}

function MessageCard({
  message,
  projectId,
  currentUserId,
  canManage,
}: {
  message: ProjectMessage
  projectId: string
  currentUserId: string
  canManage: boolean
}) {
  const update = useUpdateMessage(projectId)
  const del = useDeleteMessage(projectId)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isOwner = message.authorId === currentUserId

  return (
    <Card className={message.isPinned ? "border-amber-300 dark:border-amber-700" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AvatarDisplay
              src={message.author.profilePhoto}
              firstName={message.author.firstName}
              lastName={message.author.lastName}
              size="sm"
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">{message.title}</h4>
                {message.isPinned && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950/30"
                  >
                    <Pin className="mr-1 h-2.5 w-2.5" />
                    Pinned
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {message.author.firstName} {message.author.lastName} ·{" "}
                {formatDate(message.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {(isOwner || canManage) && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                title={message.isPinned ? "Unpin" : "Pin"}
                onClick={() =>
                  update.mutate({ messageId: message.id, body: { isPinned: !message.isPinned } })
                }
              >
                {message.isPinned ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="text-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </CardContent>

      <EditMessageDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        message={message}
        projectId={projectId}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete message"
        description="Delete this message?"
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(message.id, { onSuccess: () => setConfirmOpen(false) })}
      />
    </Card>
  )
}

function ComposeDialog({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: string
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const create = useCreateMessage(projectId)

  function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    create.mutate(
      { title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          setTitle("")
          setContent("")
          onClose()
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !create.isPending) onClose()
      }}
      title="New Message"
      isPending={create.isPending}
      submitDisabled={!title.trim() || !content.trim()}
      submitLabel="Post Message"
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <div className="space-y-2">
        <Label>Subject *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Weekly status update, Design decision…"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>Message *</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Write your message…"
        />
      </div>
    </FormDialog>
  )
}

function EditMessageDialog({
  open,
  onClose,
  message,
  projectId,
}: {
  open: boolean
  onClose: () => void
  message: ProjectMessage
  projectId: string
}) {
  const [title, setTitle] = useState(message.title)
  const [content, setContent] = useState(message.content)
  const update = useUpdateMessage(projectId)

  function handleSave() {
    update.mutate(
      { messageId: message.id, body: { title: title.trim(), content: content.trim() } },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !update.isPending) onClose()
      }}
      title="Edit Message"
      isEdit
      isPending={update.isPending}
      submitDisabled={!title.trim() || !content.trim()}
      submitLabel="Save"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      <div className="space-y-2">
        <Label>Subject</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
      </div>
    </FormDialog>
  )
}
