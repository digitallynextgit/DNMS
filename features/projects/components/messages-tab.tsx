"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
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
  useProjectMessageSearch,
  useUpdateReply,
  type ProjectMessage,
  type ProjectMember,
  type MessageSearchHit,
} from "@/features/projects/hooks/use-projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { cn } from "@/lib/utils"
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
  Smile,
  Pencil,
  Paperclip,
  Loader2,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { MentionTextarea, renderWithMentions } from "./mention-textarea"
import { HighlightedText, snippet, MIN_SEARCH_QUERY } from "@/components/shared/highlighted-text"
import { MessageAttachments, type Attachment } from "@/components/shared/message-attachments"
import { VoiceRecorder } from "@/components/shared/voice-recorder"
import { editWindowRemaining, formatWindowLeft, isWithinEditWindow } from "@/lib/edit-window"
import { dayKey, formatChatTime, formatClockTime, formatDaySeparator } from "@/lib/chat-time"

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

/**
 * Project attachments are served from their own membership-checked route, not
 * the chat one - the shared renderer takes the resolver rather than hard-coding
 * either.
 */
const projectAttachmentUrl = (id: string) => `/api/projects/message-attachments/${id}/file`

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
  /**
   * Which bubble to scroll to and flash when a chat is opened from a search hit.
   * "root" is the opening post; anything else is a reply id. Cleared once the
   * user picks a chat normally, so an old hit can't keep re-highlighting.
   */
  const [jumpTo, setJumpTo] = useState<string | null>(null)

  const query = search.trim()
  const searching = query.length >= MIN_SEARCH_QUERY
  const { data: searchData, isFetching: searchLoading } = useProjectMessageSearch(projectId, query)
  const hits = useMemo(() => searchData?.data ?? [], [searchData])
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
      <div className="bg-card flex h-[68vh] min-h-120 overflow-hidden rounded-sm border">
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

          {searching ? (
            <SearchResults
              hits={hits}
              query={query}
              loading={searchLoading}
              selectedId={selectedId}
              onOpen={(threadId, target) => {
                setSelectedId(threadId)
                setJumpTo(target)
              }}
            />
          ) : (
            <ChatList
              threads={threads}
              selectedId={selectedId}
              currentUserId={currentUserId}
              onSelect={(id) => {
                setSelectedId(id)
                setJumpTo(null)
              }}
            />
          )}
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
              jumpTo={jumpTo}
              onJumped={() => setJumpTo(null)}
              onBack={() => setSelectedId(null)}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="hidden h-full w-full flex-col items-center justify-center gap-2 md:flex">
              <div className="bg-muted flex h-14 w-14 items-center justify-center rounded">
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
  selectedId,
  currentUserId,
  onSelect,
}: {
  threads: ProjectMessage[]
  selectedId: string | null
  currentUserId: string
  onSelect: (id: string) => void
}) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-center text-xs">
          No conversations yet. Start one with +.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {threads.map((t) => {
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
                  {formatChatTime(time)}
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

// ─── Emoji picker ───────────────────────────────────────────────────────────
/**
 * A small curated set rather than a full emoji library: this is a work chat, the
 * long tail is never used, and a picker package would add a dependency (and its
 * sprite sheet) for a button. Grouped so the common reactions are reachable
 * without scrolling.
 */
const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["👍", "👌", "🙌", "👏", "🙏", "💪", "🤝", "✅", "❌", "⚠️", "❗", "❓"],
  },
  {
    label: "Faces",
    emoji: ["🙂", "😄", "😅", "😂", "😉", "😍", "🤔", "😐", "😴", "😭", "😤", "🤯"],
  },
  {
    label: "Work",
    emoji: ["🔥", "🚀", "🎯", "📌", "📅", "⏰", "📈", "📉", "💡", "🛠️", "🐞", "📝"],
  },
  {
    label: "Other",
    emoji: ["🎉", "🎊", "☕", "🍕", "❤️", "⭐", "👀", "🤖", "🧠", "💯", "✨", "🙈"],
  },
]

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // h-9 matches the field's min-h-9, so with `items-end` the icon lines
          // up dead centre against a single-row composer and stays anchored to
          // the bottom as the field grows.
          className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0 rounded-sm"
          title="Insert emoji"
          aria-label="Insert emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 rounded-sm p-2">
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                {g.label}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {g.emoji.map((e) => (
                  <button
                    key={e}
                    type="button"
                    // Stays open: picking two or three in a row is normal, and
                    // reopening between each one is the annoying part.
                    onClick={() => onPick(e)}
                    className="hover:bg-accent rounded-sm py-1 text-xl leading-none transition-colors"
                    aria-label={`Insert ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Search results (left pane, while a query is typed) ─────────────────────
/**
 * One row per MATCH, not per chat: a subject hit, the opening post, and each
 * matching reply are separate rows, because "which message was that in" is the
 * question being asked. Clicking a row opens the chat and jumps to that bubble.
 */
function SearchResults({
  hits,
  query,
  loading,
  selectedId,
  onOpen,
}: {
  hits: MessageSearchHit[]
  query: string
  loading: boolean
  selectedId: string | null
  onOpen: (threadId: string, target: string) => void
}) {
  const rows = hits.flatMap((h) => {
    const out: { key: string; threadId: string; target: string; where: string; text: string }[] = []
    if (h.titleMatch) {
      out.push({
        key: `${h.id}-title`,
        threadId: h.id,
        target: "root",
        where: "Chat name",
        text: h.title,
      })
    }
    if (h.contentMatch) {
      out.push({
        key: `${h.id}-root`,
        threadId: h.id,
        target: "root",
        where: `${shortName(`${h.author.firstName} ${h.author.lastName}`)} · opening message`,
        text: snippet(h.content, query),
      })
    }
    for (const r of h.matchedReplies) {
      out.push({
        key: r.id,
        threadId: h.id,
        target: r.id,
        where: `${shortName(r.authorName)} · ${formatChatTime(r.createdAt)}`,
        text: snippet(r.content, query),
      })
    }
    return out
  })

  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-xs">Searching…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-center text-xs">
          Nothing matches “{query}” in this project’s chats.
        </p>
      </div>
    )
  }

  const byThread = new Map(hits.map((h) => [h.id, h]))

  return (
    <div className="flex-1 overflow-y-auto">
      <p className="text-muted-foreground bg-muted/40 border-b px-3 py-1.5 text-[11px]">
        {rows.length} {rows.length === 1 ? "match" : "matches"}
      </p>
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => onOpen(row.threadId, row.target)}
          className={cn(
            "flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left transition-colors",
            row.threadId === selectedId ? "bg-muted" : "hover:bg-muted/50",
          )}
        >
          <div className="flex items-center gap-1.5">
            <MessageSquare className="text-muted-foreground h-3 w-3 shrink-0" />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {byThread.get(row.threadId)?.title}
            </p>
          </div>
          <p className="text-muted-foreground text-[10px]">{row.where}</p>
          {/* The matched line itself, with the query marked. */}
          <p className="line-clamp-3 text-xs break-words">
            <HighlightedText text={row.text} query={query} />
          </p>
        </button>
      ))}
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
  jumpTo,
  onJumped,
  onBack,
  onDeleted,
}: {
  thread: ProjectMessage
  projectId: string
  currentUserId: string
  canManage: boolean
  members: ProjectMember[]
  memberNames: Set<string>
  /** Bubble to scroll to when opened from a search hit: "root" or a reply id. */
  jumpTo: string | null
  onJumped: () => void
  onBack: () => void
  onDeleted: () => void
}) {
  const { data, isLoading } = useMessageReplies(projectId, thread.id, true)
  const replies = useMemo(() => data?.data ?? [], [data])
  const create = useCreateReply(projectId, thread.id)
  const delReply = useDeleteReply(projectId, thread.id)
  const delChat = useDeleteMessage(projectId)
  const update = useUpdateMessage(projectId)

  const updateReply = useUpdateReply(projectId, thread.id)

  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editChatOpen, setEditChatOpen] = useState(false)
  /** Reply queued for deletion, held until the confirm dialog is answered. */
  const [confirmDeleteReply, setConfirmDeleteReply] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  /** Files and voice notes both post here; the server turns them into a reply. */
  async function upload(files: File[], durationSec?: number, waveform?: number[]) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const form = new FormData()
      for (const f of files) form.append("files", f)
      if (content.trim()) form.append("body", content.trim())
      if (durationSec) form.append("durationSec", String(durationSec))
      if (waveform?.length) form.append("waveform", waveform.join(","))

      const res = await fetch(`/api/projects/${projectId}/messages/${thread.id}/attachments`, {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Upload failed")

      setContent("")
      setMentionIds([])
      qc.invalidateQueries({ queryKey: ["project-message-replies", projectId, thread.id] })
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
      throw e
    } finally {
      setUploading(false)
    }
  }

  // Replies used to arrive only on the 15s poll. One stream per person already
  // exists for personal chat, so project replies ride the same connection
  // rather than opening a second one.
  useEffect(() => {
    const es = new EventSource("/api/chat/stream")
    es.addEventListener("chat", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as {
        type: string
        conversationId: string
      }
      if (event.type !== "project-message") return
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] })
      if (event.conversationId === thread.id) {
        qc.invalidateQueries({ queryKey: ["project-message-replies", projectId, thread.id] })
      }
    })
    return () => es.close()
  }, [qc, projectId, thread.id])

  // A message stops being editable 15 minutes after it was posted, and that has
  // to happen while the user is looking at it - not at the next re-render. One
  // interval for the whole conversation re-evaluates every window each second.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)

  // Editing and deleting are the AUTHOR'S, inside the window - not a management
  // power. The server enforces exactly this (author + window, no admin override),
  // so showing these to an admin would just produce a 403.
  const isAuthor = thread.authorId === currentUserId
  const chatWindowMs = editWindowRemaining(thread.createdAt, now)
  const canEditChat = isAuthor && chatWindowMs > 0

  // Keep the view pinned to the newest message - UNLESS we were sent here by a
  // search hit, in which case the jump below owns the scroll position.
  useEffect(() => {
    if (jumpTo) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [replies.length, thread.id, isLoading, jumpTo])

  // Scroll the matched bubble into view once its replies have rendered. The
  // flash lives in `flashId` rather than staying on forever, so the highlight
  // reads as "here it is" and then gets out of the way.
  const [flashId, setFlashId] = useState<string | null>(null)
  useEffect(() => {
    if (!jumpTo || isLoading) return
    const el = document.getElementById(`msg-${thread.id}-${jumpTo}`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    setFlashId(jumpTo)
    onJumped()
    const t = setTimeout(() => setFlashId(null), 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo, isLoading, replies.length, thread.id])

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
        {/* Pinning is organising the chat list, not rewriting it, so it has no
            time limit and stays with the author / project managers. */}
        {(isAuthor || canManage) && (
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
        )}
        {canEditChat && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              title={`Edit chat · ${formatWindowLeft(chatWindowMs)}`}
              onClick={() => setEditChatOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              title={`Delete chat · ${formatWindowLeft(chatWindowMs)}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {/* Every conversation opens under the day it started on. */}
        <DaySeparator date={thread.createdAt} />

        {/* The subject's opening message is the first bubble. */}
        <Bubble
          domId={`msg-${thread.id}-root`}
          flash={flashId === "root"}
          own={thread.authorId === currentUserId}
          authorName={`${thread.author.firstName} ${thread.author.lastName}`}
          photo={thread.author.profilePhoto}
          firstName={thread.author.firstName}
          lastName={thread.author.lastName}
          content={thread.content}
          createdAt={thread.createdAt}
          memberNames={memberNames}
          edited={thread.updatedAt !== thread.createdAt}
          windowLeft={formatWindowLeft(chatWindowMs)}
          onEdit={
            canEditChat
              ? (next) => update.mutate({ messageId: thread.id, body: { content: next } })
              : undefined
          }
          opener
        />

        {isLoading ? (
          <p className="text-muted-foreground py-2 text-center text-xs">Loading messages…</p>
        ) : (
          replies.map((r, i) => (
            <Fragment key={r.id}>
              {/* A separator whenever the calendar day changes. The opening post
                  is the message before the first reply, so that comparison is
                  against the thread itself. */}
              {dayKey(r.createdAt) !==
                dayKey(i === 0 ? thread.createdAt : replies[i - 1]!.createdAt) && (
                <DaySeparator date={r.createdAt} />
              )}
              <Bubble
                domId={`msg-${thread.id}-${r.id}`}
                flash={flashId === r.id}
                own={r.authorId === currentUserId}
                authorName={`${r.author.firstName} ${r.author.lastName}`}
                photo={r.author.profilePhoto}
                firstName={r.author.firstName}
                lastName={r.author.lastName}
                content={r.content}
                attachments={r.attachments}
                createdAt={r.createdAt}
                memberNames={memberNames}
                edited={r.updatedAt !== r.createdAt}
                windowLeft={formatWindowLeft(editWindowRemaining(r.createdAt, now))}
                // Own reply, still inside the window. Once it closes these go
                // undefined and both controls vanish from the bubble.
                onEdit={
                  r.authorId === currentUserId && isWithinEditWindow(r.createdAt, now)
                    ? (next) =>
                        updateReply.mutate({
                          replyId: r.id,
                          content: next,
                          mentionedIds: r.mentionedIds ?? [],
                        })
                    : undefined
                }
                onDelete={
                  r.authorId === currentUserId && isWithinEditWindow(r.createdAt, now)
                    ? () => setConfirmDeleteReply(r.id)
                    : undefined
                }
              />
            </Fragment>
          ))
        )}
      </div>

      {/* Composer: one bar holding the emoji button, the field and Send, the way
          a messenger reads - rather than three separate controls in a row. The
          textarea is stripped of its own chrome so the BAR owns the border and
          the focus ring. Square corners (rounded-sm) on purpose - the house
          style everywhere else, not WhatsApp's pill. */}
      <div className="border-t p-3">
        <div className="border-input bg-background focus-within:ring-ring/50 flex items-end gap-1 rounded-sm border px-1.5 py-1 transition-shadow focus-within:ring-2">
          {!recording && (
            <>
              <EmojiPicker onPick={(e) => setContent((c) => c + e)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Attach a file"
                className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                aria-hidden
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  if (picked.length) void upload(picked)
                }}
              />
            </>
          )}
          <div className={cn("min-w-0 flex-1", recording && "hidden")}>
            <MentionTextarea
              value={content}
              onChange={(v, ids) => {
                setContent(v)
                setMentionIds(ids)
              }}
              members={members}
              rows={1}
              dropup
              autoGrow
              onSubmit={send}
              placeholder="Type a message…  @ to mention, Enter to send"
              // The bar draws the border and the ring, so the field itself must
              // draw neither - otherwise there are two boxes inside one another.
              // max-h-32 is where the growing stops and the scrollbar starts.
              className="max-h-32 min-h-9 resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0"
            />
          </div>
          {/* Arrow when there is something typed, mic when there is not. The
              recorder stays mounted while running - remounting it would drop the
              MediaRecorder and the clip with it. */}
          {!recording && content.trim() ? (
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-sm"
              disabled={create.isPending}
              onClick={send}
              title="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <VoiceRecorder
              disabled={uploading}
              onActiveChange={setRecording}
              onSend={async (blob, durationSec, waveform) => {
                const file = new File([blob], `voice-${durationSec}s.webm`, {
                  type: blob.type || "audio/webm",
                })
                await upload([file], durationSec, waveform)
              }}
            />
          )}
        </div>
      </div>

      <EditChatDialog
        open={editChatOpen}
        onClose={() => setEditChatOpen(false)}
        thread={thread}
        onSave={(title, content) =>
          update.mutate(
            { messageId: thread.id, body: { title, content } },
            { onSuccess: () => setEditChatOpen(false) },
          )
        }
        isPending={update.isPending}
      />

      {/* Deleting a message is not undoable, so the button holds for 3 seconds
          before it will take the click. */}
      <ConfirmDialog
        open={!!confirmDeleteReply}
        onOpenChange={(o) => !o && setConfirmDeleteReply(null)}
        title="Delete this message?"
        description="It is removed for everyone in this chat. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        confirmDelaySeconds={3}
        isLoading={delReply.isPending}
        onConfirm={() => {
          if (confirmDeleteReply)
            delReply.mutate(confirmDeleteReply, { onSuccess: () => setConfirmDeleteReply(null) })
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this chat?"
        description="This removes the whole conversation and all its replies for everyone. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        confirmDelaySeconds={3}
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
  attachments,
  createdAt,
  memberNames,
  onDelete,
  onEdit,
  windowLeft,
  edited,
  opener,
  domId,
  flash,
}: {
  own: boolean
  authorName: string
  photo?: string | null
  firstName: string
  lastName: string
  content: string
  attachments?: Attachment[]
  createdAt: string
  memberNames: Set<string>
  onDelete?: () => void
  onEdit?: (next: string) => void
  /** "12m left" - the remaining edit window, shown on the controls. */
  windowLeft?: string
  edited?: boolean
  opener?: boolean
  /** Scroll target for a search jump. */
  domId?: string
  /** Briefly ringed after being jumped to, so the eye lands on the right bubble. */
  flash?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  const startEdit = () => {
    setDraft(content)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => {
    const next = draft.trim()
    if (!next || next === content) return cancelEdit()
    onEdit?.(next)
    setEditing(false)
  }

  return (
    <div
      id={domId}
      className={cn(
        "group flex scroll-mt-4 items-end gap-2",
        own ? "flex-row-reverse" : "flex-row",
      )}
    >
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
          "relative max-w-[78%] rounded-sm px-3 py-2 text-sm shadow-sm transition-shadow sm:max-w-[70%]",
          own
            ? "rounded-br-sm bg-emerald-600 text-white dark:bg-emerald-700"
            : "bg-muted text-foreground rounded-bl-sm",
          flash && "ring-2 ring-amber-400 ring-offset-1",
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
        {editing ? (
          // Inline editor: same bubble, so the message keeps its place in the
          // conversation instead of jumping into a modal.
          <div className="space-y-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className={cn(
                "resize-y text-sm",
                own && "border-white/30 bg-white/10 text-white placeholder:text-white/50",
              )}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation()
                  cancelEdit()
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit()
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 px-2 text-xs", own && "text-white hover:bg-white/15")}
                onClick={cancelEdit}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!draft.trim() || draft.trim() === content}
                onClick={saveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {attachments && attachments.length > 0 && (
              <div className="mb-1.5">
                <MessageAttachments
                  attachments={attachments}
                  fromMe={own}
                  urlFor={projectAttachmentUrl}
                  avatar={own ? null : { src: photo ?? null, firstName, lastName }}
                />
              </div>
            )}
            {/* A file sent with no caption gets "Photo" / "Voice message" as its
                text so the thread list reads properly - but repeating that under
                the player itself is noise. */}
            {!(attachments?.length && AUTO_CAPTIONS.has(content)) && (
              <div className="leading-relaxed whitespace-pre-wrap">
                {renderWithMentions(content, memberNames)}
              </div>
            )}
          </>
        )}
        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1.5 text-[10px]",
            own ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {edited && <span className="italic">edited</span>}
          {/* Time only - the day is on the separator above this run of messages. */}
          <span>{formatClockTime(createdAt)}</span>
        </div>
      </div>

      {/* Author controls. They exist only inside the 15 minute window - the
          parent stops passing the handlers once it closes, and re-renders on a
          timer so they disappear on their own rather than at the next click. */}
      {!editing && (onEdit || onDelete) && (
        <div className="mb-4 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={startEdit}
              title={windowLeft ? `Edit message · ${windowLeft}` : "Edit message"}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title={windowLeft ? `Delete message · ${windowLeft}` : "Delete message"}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Captions the server writes when a file is sent with nothing typed. */
const AUTO_CAPTIONS = new Set(["Photo", "Voice message", "File"])

// ─── Day separator ──────────────────────────────────────────────────────────
/**
 * The centred "Today / Yesterday / Saturday / 5 Aug" chip between days. This is
 * what lets the bubbles carry a bare clock time: the day is stated once for the
 * run of messages beneath it instead of being repeated on every bubble.
 */
function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="bg-muted text-muted-foreground rounded-sm px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase shadow-sm">
        {formatDaySeparator(date)}
      </span>
    </div>
  )
}

// ─── Edit chat dialog (subject + opening message) ───────────────────────────
/**
 * The chat's subject line and its opening post are one record, so they are
 * edited together. Only reachable inside the 15 minute window - the header stops
 * rendering the button after that, and the API refuses regardless.
 */
function EditChatDialog({
  open,
  onClose,
  thread,
  onSave,
  isPending,
}: {
  open: boolean
  onClose: () => void
  thread: ProjectMessage
  onSave: (title: string, content: string) => void
  isPending: boolean
}) {
  const [title, setTitle] = useState(thread.title)
  const [content, setContent] = useState(thread.content)

  // Re-seed each time it opens, so a cancelled edit is genuinely discarded.
  useEffect(() => {
    if (open) {
      setTitle(thread.title)
      setContent(thread.content)
    }
  }, [open, thread.title, thread.content])

  const dirty = title.trim() !== thread.title || content.trim() !== thread.content

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && !isPending && onClose()}
      title="Edit chat"
      isEdit
      isPending={isPending}
      submitDisabled={!title.trim() || !content.trim() || !dirty}
      submitLabel="Save changes"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(title.trim(), content.trim())
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-chat-title">Subject</Label>
          <Input
            id="edit-chat-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this chat about?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-chat-content">Opening message</Label>
          <Textarea
            id="edit-chat-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </div>
      </div>
    </FormDialog>
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
