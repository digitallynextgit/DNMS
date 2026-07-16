"use client"

import { useEffect, useMemo, useState } from "react"
import {
  useProjectMessages,
  useProjectMembers,
  useCreateMessage,
  useUpdateMessage,
  useDeleteMessage,
  useMessageReplies,
  useCreateReply,
  useDeleteReply,
  useMarkMessagesSeen,
  type ProjectMessage,
  type ProjectMember,
} from "@/features/projects/hooks/use-projects"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  Pencil,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Send,
} from "lucide-react"
import { MentionTextarea, renderWithMentions } from "./mention-textarea"

interface Props {
  projectId: string
  currentUserId: string
  canManage: boolean
}

export function MessagesTab({ projectId, currentUserId, canManage }: Props) {
  const { data, isLoading } = useProjectMessages(projectId)
  const { data: membersData } = useProjectMembers(projectId)
  const members = useMemo(() => membersData?.data ?? [], [membersData])
  const memberNames = useMemo(
    () => new Set(members.map((m) => `${m.firstName} ${m.lastName}`.trim())),
    [members],
  )
  const messages = data?.data ?? []
  const [composeOpen, setComposeOpen] = useState(false)

  // Opening the tab (mounting this component) clears the unread badge. Runs once
  // per open; if new messages arrive while viewing, the badge reappears on return.
  const markSeen = useMarkMessagesSeen(projectId)
  useEffect(() => {
    markSeen.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

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
              members={members}
              memberNames={memberNames}
            />
          ))}
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        projectId={projectId}
        members={members}
      />
    </div>
  )
}

function MessageCard({
  message,
  projectId,
  currentUserId,
  canManage,
  members,
  memberNames,
}: {
  message: ProjectMessage
  projectId: string
  currentUserId: string
  canManage: boolean
  members: ProjectMember[]
  memberNames: Set<string>
}) {
  const update = useUpdateMessage(projectId)
  const del = useDeleteMessage(projectId)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isOwner = message.authorId === currentUserId
  const replyCount = message._count?.replies ?? 0

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
          {renderWithMentions(message.content, memberNames)}
        </div>

        {/* Thread toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <MessageSquare className="h-3.5 w-3.5" />
          {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "Reply"}
        </button>

        {expanded && (
          <MessageThread
            projectId={projectId}
            messageId={message.id}
            currentUserId={currentUserId}
            members={members}
            memberNames={memberNames}
          />
        )}
      </CardContent>

      <EditMessageDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        message={message}
        projectId={projectId}
        members={members}
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

function MessageThread({
  projectId,
  messageId,
  currentUserId,
  members,
  memberNames,
}: {
  projectId: string
  messageId: string
  currentUserId: string
  members: ProjectMember[]
  memberNames: Set<string>
}) {
  const { data, isLoading } = useMessageReplies(projectId, messageId, true)
  const replies = data?.data ?? []
  const create = useCreateReply(projectId, messageId)
  const del = useDeleteReply(projectId, messageId)
  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])

  function send() {
    if (!content.trim()) return
    create.mutate(
      { content: content.trim(), mentionedIds: mentionIds },
      {
        onSuccess: () => {
          setContent("")
          setMentionIds([])
        },
      },
    )
  }

  return (
    <div className="border-muted mt-3 space-y-3 border-l-2 pl-4">
      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading replies…</p>
      ) : (
        replies.map((r) => (
          <div key={r.id} className="group flex items-start gap-2.5">
            <AvatarDisplay
              src={r.author.profilePhoto}
              firstName={r.author.firstName}
              lastName={r.author.lastName}
              size="xs"
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px]">
                <span className="text-foreground font-medium">
                  {r.author.firstName} {r.author.lastName}
                </span>
                <span className="text-muted-foreground"> · {formatRelativeTime(r.createdAt)}</span>
              </p>
              <div className="text-muted-foreground mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                {renderWithMentions(r.content, memberNames)}
              </div>
            </div>
            {r.authorId === currentUserId && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete reply"
                onClick={() => del.mutate(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))
      )}

      {/* Reply composer */}
      <div className="flex items-start gap-2 pt-1">
        <CornerDownRight className="text-muted-foreground mt-2 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <MentionTextarea
            value={content}
            onChange={(v, ids) => {
              setContent(v)
              setMentionIds(ids)
            }}
            members={members}
            rows={2}
            placeholder="Write a reply… Type @ to mention someone."
          />
        </div>
        <Button
          size="icon-sm"
          className="mt-1 shrink-0"
          disabled={!content.trim() || create.isPending}
          onClick={send}
          title="Send reply"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ComposeDialog({
  open,
  onClose,
  projectId,
  members,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  members: ProjectMember[]
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const create = useCreateMessage(projectId)

  function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    create.mutate(
      { title: title.trim(), content: content.trim(), mentionedIds: mentionIds },
      {
        onSuccess: () => {
          setTitle("")
          setContent("")
          setMentionIds([])
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
        <MentionTextarea
          value={content}
          onChange={(v, ids) => {
            setContent(v)
            setMentionIds(ids)
          }}
          members={members}
          rows={5}
          placeholder="Write your message… Type @ to tag a team member."
        />
        <p className="text-muted-foreground text-[11px]">
          Type <span className="font-medium">@</span> to mention a teammate — they&apos;ll get a
          notification.
        </p>
      </div>
    </FormDialog>
  )
}

function EditMessageDialog({
  open,
  onClose,
  message,
  projectId,
  members,
}: {
  open: boolean
  onClose: () => void
  message: ProjectMessage
  projectId: string
  members: ProjectMember[]
}) {
  const [title, setTitle] = useState(message.title)
  const [content, setContent] = useState(message.content)
  // Start from the mentions already on the message so an untouched edit keeps them.
  const [mentionIds, setMentionIds] = useState<string[]>(message.mentionedIds ?? [])
  const update = useUpdateMessage(projectId)

  function handleSave() {
    update.mutate(
      {
        messageId: message.id,
        body: { title: title.trim(), content: content.trim(), mentionedIds: mentionIds },
      },
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
        <MentionTextarea
          value={content}
          onChange={(v, ids) => {
            setContent(v)
            // Union with existing so mentions already saved (but not re-picked in
            // this session) are preserved as long as their @token stays in the text.
            setMentionIds((prev) => {
              const kept = (message.mentionedIds ?? []).filter((id) => {
                const m = members.find((mm) => mm.id === id)
                return m && v.includes(`@${m.firstName} ${m.lastName}`.trim())
              })
              return [...new Set([...kept, ...ids])]
            })
          }}
          members={members}
          rows={5}
          placeholder="Write your message… Type @ to tag a team member."
        />
      </div>
    </FormDialog>
  )
}
