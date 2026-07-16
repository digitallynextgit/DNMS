"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  useProjectMessages,
  useProjectMembers,
  useCreateMessage,
  useDeleteMessage,
  useUpdateMessage,
  useMessageReplies,
  useCreateReply,
  useDeleteReply,
  useMarkMessagesSeen,
  type ProjectMessage,
  type ProjectMember,
} from "@/features/projects/hooks/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Send,
  Trash2,
  Pin,
  PinOff,
  ArrowLeft,
  MessageSquare,
  Megaphone,
} from "lucide-react"
import { MentionTextarea, renderWithMentions } from "./mention-textarea"

interface Props {
  projectId: string
  currentUserId: string
  canManage: boolean
}

// Recall/change a just-sent message or reply for this long.
const UNDO_MS = 60_000

type ComposeDraft = { title: string; content: string; mentionIds: string[] }

function toMentionPairs(ids: string[], members: ProjectMember[]) {
  return ids
    .map((id) => {
      const m = members.find((mm) => mm.id === id)
      return m ? { id, label: `${m.firstName} ${m.lastName}`.trim() } : null
    })
    .filter((x): x is { id: string; label: string } => x !== null)
}

const shortName = (full: string) => full.split(" ")[0] || full

// ════════════════════════════════════════════════════════════════════════════
// Chat shell: a WhatsApp-style two-pane layout - the list of "chats" (each
// subject is a conversation) on the left, the open conversation on the right.
// ════════════════════════════════════════════════════════════════════════════
export function MessagesTab({ projectId, currentUserId, canManage }: Props) {
  const { data, isLoading } = useProjectMessages(projectId)
  const { data: membersData } = useProjectMembers(projectId)
  const members = useMemo(() => membersData?.data ?? [], [membersData])
  const memberNames = useMemo(
    () => new Set(members.map((m) => `${m.firstName} ${m.lastName}`.trim())),
    [members],
  )
  const threads = useMemo(() => data?.data ?? [], [data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatInitial, setNewChatInitial] = useState<ComposeDraft | null>(null)

  // Clear the unread badge when the tab opens.
  const markSeen = useMarkMessagesSeen(projectId)
  useEffect(() => {
    markSeen.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Drop the selection if that chat was deleted out from under us.
  useEffect(() => {
    if (selectedId && threads.length && !threads.some((t) => t.id === selectedId)) {
      setSelectedId(null)
    }
  }, [threads, selectedId])

  const selected = threads.find((t) => t.id === selectedId) ?? null

  if (isLoading) {
    return <ListSkeleton rows={4} height="h-16" className="mt-2 space-y-2" />
  }

  return (
    <>
      <div className="bg-card flex h-[68vh] min-h-120 overflow-hidden rounded-lg border">
        {/* LEFT: chat list */}
        <div
          className={cn(
            "flex w-full flex-col border-r md:w-80 lg:w-96",
            selected && "hidden md:flex",
          )}
        >
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats…"
                className="h-9 pl-8"
              />
            </div>
            <Button
              size="icon-sm"
              className="h-9 w-9 shrink-0"
              title="New chat"
              onClick={() => {
                setNewChatInitial(null)
                setNewChatOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ChatList
            threads={threads}
            search={search}
            selectedId={selectedId}
            currentUserId={currentUserId}
            onSelect={setSelectedId}
          />
        </div>

        {/* RIGHT: conversation */}
        <div className={cn("min-w-0 flex-1", !selected && "hidden md:flex")}>
          {selected ? (
            <ChatView
              key={selected.id}
              thread={selected}
              projectId={projectId}
              currentUserId={currentUserId}
              canManage={canManage}
              members={members}
              memberNames={memberNames}
              onBack={() => setSelectedId(null)}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="hidden h-full w-full flex-col items-center justify-center gap-2 md:flex">
              <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
                <MessageSquare className="text-muted-foreground h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Project chat</p>
              <p className="text-muted-foreground max-w-xs text-center text-xs">
                Pick a conversation on the left, or start a new one to post an update for the team.
              </p>
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        projectId={projectId}
        members={members}
        initial={newChatInitial}
        onCreated={(id) => setSelectedId(id)}
        onReopenWithDraft={(draft, deletedId) => {
          if (deletedId) setSelectedId((cur) => (cur === deletedId ? null : cur))
          setNewChatInitial(draft)
          setNewChatOpen(true)
        }}
      />
    </>
  )
}

// ─── Chat list (left pane) ──────────────────────────────────────────────────
function ChatList({
  threads,
  search,
  selectedId,
  currentUserId,
  onSelect,
}: {
  threads: ProjectMessage[]
  search: string
  selectedId: string | null
  currentUserId: string
  onSelect: (id: string) => void
}) {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? threads.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          (t.lastReply?.content ?? "").toLowerCase().includes(q),
      )
    : threads

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-center text-xs">
          {q ? "No chats match your search." : "No conversations yet. Start one with +."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.map((t) => {
        const preview = t.lastReply
          ? `${shortName(t.lastReply.authorName)}: ${t.lastReply.content}`
          : t.content
        const time = t.lastActivityAt ?? t.createdAt
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors",
              t.id === selectedId ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <AvatarDisplay
              src={t.author.profilePhoto}
              firstName={t.author.firstName}
              lastName={t.author.lastName}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {t.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</p>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatRelativeTime(time)}
                </span>
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {t.author.id === currentUserId && !t.lastReply ? "You: " : ""}
                {preview}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Conversation (right pane) ──────────────────────────────────────────────
function ChatView({
  thread,
  projectId,
  currentUserId,
  canManage,
  members,
  memberNames,
  onBack,
  onDeleted,
}: {
  thread: ProjectMessage
  projectId: string
  currentUserId: string
  canManage: boolean
  members: ProjectMember[]
  memberNames: Set<string>
  onBack: () => void
  onDeleted: () => void
}) {
  const { data, isLoading } = useMessageReplies(projectId, thread.id, true)
  const replies = useMemo(() => data?.data ?? [], [data])
  const create = useCreateReply(projectId, thread.id)
  const delReply = useDeleteReply(projectId, thread.id)
  const delChat = useDeleteMessage(projectId)
  const update = useUpdateMessage(projectId)

  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const canManageChat = thread.authorId === currentUserId || canManage

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [replies.length, thread.id, isLoading])

  function send() {
    if (!content.trim()) return
    const draft = { content: content.trim(), mentionIds }
    create.mutate(
      { content: draft.content, mentionedIds: draft.mentionIds },
      {
        onSuccess: (res) => {
          const created = res.data
          setContent("")
          setMentionIds([])
          toast("Sent", {
            duration: UNDO_MS,
            action: {
              label: "Undo",
              onClick: () => {
                delReply.mutate(created.id)
                setContent(draft.content)
                setMentionIds(draft.mentionIds)
              },
            },
          })
        },
      },
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <AvatarDisplay
          src={thread.author.profilePhoto}
          firstName={thread.author.firstName}
          lastName={thread.author.lastName}
          size="sm"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{thread.title}</p>
            {thread.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
          </div>
          <p className="text-muted-foreground truncate text-[11px]">
            Started by {thread.author.firstName} {thread.author.lastName} · {replies.length + 1}{" "}
            message{replies.length === 0 ? "" : "s"}
          </p>
        </div>
        {canManageChat && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              title={thread.isPinned ? "Unpin chat" : "Pin chat"}
              onClick={() =>
                update.mutate({ messageId: thread.id, body: { isPinned: !thread.isPinned } })
              }
            >
              {thread.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              title="Delete chat"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {/* The subject's opening message is the first bubble. */}
        <Bubble
          own={thread.authorId === currentUserId}
          authorName={`${thread.author.firstName} ${thread.author.lastName}`}
          photo={thread.author.profilePhoto}
          firstName={thread.author.firstName}
          lastName={thread.author.lastName}
          content={thread.content}
          createdAt={thread.createdAt}
          memberNames={memberNames}
          opener
        />

        {isLoading ? (
          <p className="text-muted-foreground py-2 text-center text-xs">Loading messages…</p>
        ) : (
          replies.map((r) => (
            <Bubble
              key={r.id}
              own={r.authorId === currentUserId}
              authorName={`${r.author.firstName} ${r.author.lastName}`}
              photo={r.author.profilePhoto}
              firstName={r.author.firstName}
              lastName={r.author.lastName}
              content={r.content}
              createdAt={r.createdAt}
              memberNames={memberNames}
              onDelete={r.authorId === currentUserId ? () => delReply.mutate(r.id) : undefined}
            />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t p-3">
        <div className="min-w-0 flex-1">
          <MentionTextarea
            value={content}
            onChange={(v, ids) => {
              setContent(v)
              setMentionIds(ids)
            }}
            members={members}
            rows={1}
            dropup
            onSubmit={send}
            placeholder="Type a message…  @ to mention, Enter to send"
          />
        </div>
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          disabled={!content.trim() || create.isPending}
          onClick={send}
          title="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this chat?"
        description="This removes the whole conversation and all its replies for everyone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={delChat.isPending}
        onConfirm={() =>
          delChat.mutate(thread.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onDeleted()
            },
          })
        }
      />
    </div>
  )
}

// ─── One chat bubble ────────────────────────────────────────────────────────
function Bubble({
  own,
  authorName,
  photo,
  firstName,
  lastName,
  content,
  createdAt,
  memberNames,
  onDelete,
  opener,
}: {
  own: boolean
  authorName: string
  photo?: string | null
  firstName: string
  lastName: string
  content: string
  createdAt: string
  memberNames: Set<string>
  onDelete?: () => void
  opener?: boolean
}) {
  return (
    <div className={cn("group flex items-end gap-2", own ? "flex-row-reverse" : "flex-row")}>
      {!own && (
        <AvatarDisplay
          src={photo}
          firstName={firstName}
          lastName={lastName}
          size="xs"
          className="mb-4 shrink-0"
        />
      )}
      <div
        className={cn(
          "relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
          own
            ? "rounded-br-sm bg-emerald-600 text-white dark:bg-emerald-700"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {!own && (
          <p className="mb-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            {authorName}
          </p>
        )}
        {opener && (
          <p
            className={cn(
              "mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase opacity-70",
            )}
          >
            <Megaphone className="h-3 w-3" /> Opening message
          </p>
        )}
        <div className="leading-relaxed whitespace-pre-wrap">
          {renderWithMentions(content, memberNames)}
        </div>
        <div
          className={cn(
            "mt-0.5 text-right text-[10px]",
            own ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {formatRelativeTime(createdAt)}
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete message"
          className="text-muted-foreground hover:text-destructive mb-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── New chat dialog (subject + first message) ──────────────────────────────
function NewChatDialog({
  open,
  onClose,
  projectId,
  members,
  initial,
  onCreated,
  onReopenWithDraft,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  members: ProjectMember[]
  initial: ComposeDraft | null
  onCreated: (id: string) => void
  onReopenWithDraft: (draft: ComposeDraft, deletedId?: string) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [content, setContent] = useState(initial?.content ?? "")
  const [mentionIds, setMentionIds] = useState<string[]>(initial?.mentionIds ?? [])
  const create = useCreateMessage(projectId)
  const del = useDeleteMessage(projectId)

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "")
      setContent(initial?.content ?? "")
      setMentionIds(initial?.mentionIds ?? [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const initialMentions = useMemo(
    () => toMentionPairs(initial?.mentionIds ?? [], members),
    [initial, members],
  )

  function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    const draft: ComposeDraft = { title: title.trim(), content: content.trim(), mentionIds }
    create.mutate(
      { title: draft.title, content: draft.content, mentionedIds: draft.mentionIds },
      {
        onSuccess: (res) => {
          const created = res.data
          setTitle("")
          setContent("")
          setMentionIds([])
          onClose()
          onCreated(created.id)
          toast("Chat started", {
            duration: UNDO_MS,
            action: {
              label: "Undo",
              onClick: () => {
                del.mutate(created.id)
                onReopenWithDraft(draft, created.id)
              },
            },
          })
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
      title="New chat"
      isPending={create.isPending}
      submitDisabled={!title.trim() || !content.trim()}
      submitLabel="Start chat"
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
          placeholder="e.g. Weekly status, Launch plan…"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>First message *</Label>
        <MentionTextarea
          value={content}
          onChange={(v, ids) => {
            setContent(v)
            setMentionIds(ids)
          }}
          members={members}
          initialMentions={initialMentions}
          rows={4}
          placeholder="Write the opening message… Type @ to mention a teammate."
        />
        <p className="text-muted-foreground text-[11px]">
          Mentioned teammates get a notification. You&apos;ll have a minute to undo after starting.
        </p>
      </div>
    </FormDialog>
  )
}
