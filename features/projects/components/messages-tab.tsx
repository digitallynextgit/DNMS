"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { cn } from "@/lib/utils"
import { SPLIT_PANE_HEADER, SPLIT_PANE_ROW } from "@/lib/constants"
import { MessageComposer } from "@/components/shared/message-composer"
import { ForwardDialog } from "@/components/shared/forward-dialog"
import { AttachmentPreview } from "@/components/shared/attachment-preview"
import { MediaViewer, type MediaItem } from "@/components/shared/media-viewer"
import { BUBBLE_OUT, BUBBLE_IN, BubbleTail, DayChip } from "@/components/shared/chat-bubble"
import {
  MessageReactions,
  ReactionButton,
  type ReactionGroup,
} from "@/components/shared/message-reactions"
import {
  MessageTicks,
  MessageInfoDialog,
  type Delivery,
  type ReceiptPerson,
} from "@/components/shared/message-receipts"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Trash2,
  Pin,
  PinOff,
  ArrowLeft,
  MessageSquare,
  Megaphone,
  Pencil,
  Copy,
  Reply,
  Forward,
  Info,
  MoreVertical,
  X,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { MentionTextarea, renderWithMentions } from "@/components/shared/mention-textarea"
import { HighlightedText, snippet, MIN_SEARCH_QUERY } from "@/components/shared/highlighted-text"
import { MessageAttachments, type Attachment } from "@/components/shared/message-attachments"
import {
  MessageCards,
  PollComposer,
  EventComposer,
  ContactComposer,
  type PollCardData,
  type EventCardData,
  type ContactCardData,
  type CardEndpoint,
} from "@/components/shared/message-cards"
import {
  MESSAGE_EDIT_WINDOW_MS,
  editWindowRemaining,
  formatWindowLeft,
  isWithinEditWindow,
} from "@/lib/edit-window"
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
      {/* dvh, and a smaller min-height below md. The bottom tab bar is a real
          layout row, so `main` is shorter than the viewport on phones: a
          `min-h-120` (480px) pane inside a ~440px row pushed the composer out of
          reach. chat-view.tsx:207 documents the same fix; this was missed. */}
      <div className="bg-card flex h-[68dvh] min-h-80 overflow-hidden rounded-sm border md:min-h-120">
        {/* LEFT: chat list */}
        <div
          className={cn(
            "flex w-full flex-col border-r md:w-80 lg:w-96",
            selected && "hidden md:flex",
          )}
        >
          <div className={cn(SPLIT_PANE_HEADER, "gap-2 px-3")}>
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
            className={cn(SPLIT_PANE_ROW, t.id === selectedId ? "bg-muted" : "hover:bg-muted/50")}
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
  const readers = useMemo(() => data?.readers ?? [], [data])

  // Assembled HERE rather than in a bubble: only the thread knows what else was
  // posted, which is what makes next/previous and the filmstrip possible.
  const gallery = useMemo<MediaItem[]>(
    () =>
      replies.flatMap((r) =>
        (r.attachments ?? [])
          .filter((a) => a.kind === "IMAGE" || a.kind === "VIDEO")
          .map((a) => ({
            id: a.id,
            fileName: a.fileName,
            kind: a.kind,
            authorName: `${r.author.firstName} ${r.author.lastName}`.trim(),
            authorPhoto: r.author.profilePhoto,
            createdAt: r.createdAt,
          })),
      ),
    [replies],
  )

  /**
   * Everyone this message went to, with when they last opened the chat. Excludes
   * the author (you cannot un-read your own message) and anyone with no mark at
   * all is carried through with `seenAt: null` so the info panel can list them
   * under "not read by" rather than silently dropping them.
   */
  // Indexed once per readers change. This was `readers.find(...)` INSIDE the
  // map below, so building one message's audience was O(members x readers) -
  // and it ran per bubble, on every render, on a 1s tick.
  const seenAtById = useMemo(() => new Map(readers.map((r) => [r.id, r.lastSeenAt])), [readers])

  const audienceFor = useCallback(
    (authorId: string): ReceiptPerson[] =>
      members
        .filter((m) => m.id !== authorId)
        .map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          profilePhoto: m.profilePhoto,
          seenAt: seenAtById.get(m.id) ?? null,
        })),
    [members, seenAtById],
  )

  /**
   * Group-chat ticks, WhatsApp's rule: one tick until somebody has opened it,
   * two once some have, two blue once everyone has. There is no separate
   * "delivered" signal for a project chat, so "delivered" here means "seen by
   * some" rather than pretending to a network receipt we never collected.
   */
  const deliveryFor = useCallback(
    (authorId: string, createdAt: string): Delivery => {
      const audience = audienceFor(authorId)
      if (audience.length === 0) return "sent"
      const sent = new Date(createdAt).getTime()
      const seen = audience.filter((a) => a.seenAt && new Date(a.seenAt).getTime() >= sent).length
      if (seen === 0) return "sent"
      return seen === audience.length ? "read" : "delivered"
    },
    [audienceFor],
  )

  const [infoFor, setInfoFor] = useState<{ authorId: string; createdAt: string } | null>(null)
  /** Files picked but not yet sent - the review screen is open while this is
   *  non-empty. Nothing is uploaded until Send, so backing out is free. */
  /** Which attachment the viewer is on, by id. Null = closed. */
  const [viewing, setViewing] = useState<string | null>(null)
  const [staged, setStaged] = useState<File[]>([])
  const viewingIndex = viewing ? gallery.findIndex((g) => g.id === viewing) : -1
  const [forwarding, setForwarding] = useState<string | null>(null)
  /** The bubble the composer is answering: its id ("root" = the opening post),
   *  who wrote it and a snippet, so the banner needs no second lookup. */
  const [replyTo, setReplyTo] = useState<{
    id: string
    authorName: string
    content: string
  } | null>(null)

  /** Toggle one emoji. `replyId` omitted = the opening post. */
  const react = useMutation({
    mutationFn: ({ emoji, replyId }: { emoji: string; replyId?: string }) =>
      apiFetch(`/api/projects/${projectId}/messages/${thread.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, replyId }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["project-message-replies", projectId, thread.id] }),
    onError: (e: Error) => toast.error(e.message),
  })
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
  const [card, setCard] = useState<"poll" | "event" | "contact" | null>(null)
  const qc = useQueryClient()

  /** Files and voice notes both post here; the server turns them into a reply. */
  async function upload(
    files: File[],
    durationSec?: number,
    waveform?: number[],
    asSticker?: boolean,
    /** Caption from the preview screen. Falls back to whatever is in the
     *  composer, which is how a voice note or sticker carries typed text. */
    caption?: string,
  ) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const body = (caption ?? content).trim()
      const form = new FormData()
      for (const f of files) form.append("files", f)
      if (body) form.append("body", body)
      if (durationSec) form.append("durationSec", String(durationSec))
      if (waveform?.length) form.append("waveform", waveform.join(","))
      if (asSticker) form.append("sticker", "1")

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
  //
  // GATED, though: it used to tick forever on every open thread, re-rendering
  // the entire message list once a second for the life of the tab. The clock is
  // only worth running while something is actually still inside its window, so
  // the interval starts when one is and stops as soon as the last one closes.
  const newestPostedAt = useMemo(() => {
    let newest = new Date(thread.createdAt).getTime()
    for (const r of replies) {
      const t = new Date(r.createdAt).getTime()
      if (t > newest) newest = t
    }
    return newest
  }, [thread.createdAt, replies])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    // Re-armed whenever a new message arrives (newestPostedAt changes).
    if (Date.now() >= newestPostedAt + MESSAGE_EDIT_WINDOW_MS) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= newestPostedAt + MESSAGE_EDIT_WINDOW_MS) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [newestPostedAt])

  const scrollRef = useRef<HTMLDivElement>(null)

  const cardEndpoint: CardEndpoint = {
    createUrl: `/api/projects/${projectId}/messages/${thread.id}/cards`,
    invalidate: [
      ["project-message-replies", projectId, thread.id],
      ["project-messages", projectId],
    ],
  }

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
  // Search WITHIN the open chat, the same affordance personal Chat has in its
  // header. The left pane already searches across every chat in the project;
  // this is the half that finds what somebody actually said in this one.
  //
  // No endpoint: the opening post and every reply are already loaded, so this
  // filters what is in hand. A round trip to re-fetch text the page is holding
  // would be slower AND capable of disagreeing with what is on screen.
  const [searching, setSearching] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const trimmedQ = searchQ.trim()
  const hits = useMemo(() => {
    if (trimmedQ.length < MIN_SEARCH_QUERY) return []
    const needle = trimmedQ.toLowerCase()
    const all = [
      { id: "root", author: thread.author, content: thread.content, createdAt: thread.createdAt },
      ...replies.map((r) => ({
        id: r.id,
        author: r.author,
        content: r.content,
        createdAt: r.createdAt,
      })),
    ]
    return all.filter((m) => m.content.toLowerCase().includes(needle))
  }, [trimmedQ, thread.author, thread.content, thread.createdAt, replies])

  // flash lives in `flashId` rather than staying on forever, so the highlight
  // reads as "here it is" and then gets out of the way.
  const [flashId, setFlashId] = useState<string | null>(null)

  /** Scroll to a message in THIS chat and flash it - what a search hit does. */
  const jumpToLocal = (id: string) => {
    document.getElementById(`msg-${thread.id}-${id}`)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    })
    setFlashId(id)
    setTimeout(() => setFlashId(null), 2500)
  }
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
    const draft = { content: content.trim(), mentionIds, replyToId: replyTo?.id }
    setReplyTo(null)
    create.mutate(
      { content: draft.content, mentionedIds: draft.mentionIds, replyToId: draft.replyToId },
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
    // relative: the attachment review screen covers THIS pane, not the viewport.
    <div className="relative flex h-full w-full flex-col">
      {/* Header */}
      <div className={cn(SPLIT_PANE_HEADER, "gap-2 px-3")}>
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={searching ? "Close search" : "Search in chat"}
          title={searching ? "Close search" : "Search in chat"}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setSearching((v) => !v)
            setSearchQ("")
          }}
        >
          {searching ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>

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

      {searching && (
        <div className="bg-card shrink-0 border-b p-2">
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search in this chat"
            autoFocus
            className="h-9 text-sm"
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {trimmedQ.length > 0 && trimmedQ.length < MIN_SEARCH_QUERY && (
              <p className="text-muted-foreground px-1 py-2 text-xs">Keep typing…</p>
            )}
            {trimmedQ.length >= MIN_SEARCH_QUERY && hits.length === 0 && (
              <p className="text-muted-foreground px-1 py-2 text-xs">No messages match.</p>
            )}
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => jumpToLocal(h.id)}
                className="hover:bg-muted w-full rounded-sm px-2 py-1.5 text-left transition-colors"
              >
                <span className="text-muted-foreground block text-[10px]">
                  {h.author.id === currentUserId ? "You" : h.author.firstName} ·{" "}
                  {formatClockTime(h.createdAt)}
                </span>
                <span className="block truncate text-xs">
                  <HighlightedText text={snippet(h.content, trimmedQ)} query={trimmedQ} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="bg-background flex-1 overflow-y-auto px-3 py-3">
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
          delivery={deliveryFor(thread.authorId, thread.createdAt)}
          onInfo={() => setInfoFor({ authorId: thread.authorId, createdAt: thread.createdAt })}
          reactions={thread.reactions ?? []}
          onReact={(emoji) => react.mutate({ emoji })}
          onOpenMedia={setViewing}
          onForward={() => setForwarding(thread.content)}
          onReply={() =>
            setReplyTo({
              id: "root",
              authorName: `${thread.author.firstName} ${thread.author.lastName}`.trim(),
              content: thread.content,
            })
          }
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
          replies.map((r, i) => {
            // The opening post is the message before the first reply, so both
            // the day break and the run break compare against the thread itself.
            const prev = i === 0 ? null : replies[i - 1]!
            const prevAuthor = prev ? prev.authorId : thread.authorId
            const prevDay = dayKey(prev ? prev.createdAt : thread.createdAt)
            const newDay = dayKey(r.createdAt) !== prevDay
            // A run is consecutive replies from ONE author on ONE day: the first
            // carries the tail, avatar, name and gap; the rest sit tight beneath.
            const startsRun = newDay || r.authorId !== prevAuthor
            return (
              <Fragment key={r.id}>
                {newDay && <DaySeparator date={r.createdAt} />}
                <Bubble
                  startsRun={startsRun}
                  domId={`msg-${thread.id}-${r.id}`}
                  flash={flashId === r.id}
                  own={r.authorId === currentUserId}
                  authorName={`${r.author.firstName} ${r.author.lastName}`}
                  photo={r.author.profilePhoto}
                  firstName={r.author.firstName}
                  lastName={r.author.lastName}
                  content={r.content}
                  attachments={r.attachments}
                  poll={r.poll}
                  event={r.event}
                  contact={r.contact}
                  onVoted={() =>
                    qc.invalidateQueries({
                      queryKey: ["project-message-replies", projectId, thread.id],
                    })
                  }
                  createdAt={r.createdAt}
                  memberNames={memberNames}
                  delivery={deliveryFor(r.authorId, r.createdAt)}
                  onInfo={() => setInfoFor({ authorId: r.authorId, createdAt: r.createdAt })}
                  reactions={r.reactions ?? []}
                  onReact={(emoji) => react.mutate({ emoji, replyId: r.id })}
                  onOpenMedia={setViewing}
                  onForward={() => setForwarding(r.content)}
                  onReply={() =>
                    setReplyTo({
                      id: r.id,
                      authorName: `${r.author.firstName} ${r.author.lastName}`.trim(),
                      content: r.content,
                    })
                  }
                  quote={r.replyTo ?? null}
                  onJumpToQuote={jumpToLocal}
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
            )
          })
        )}
      </div>

      {replyTo && !recording && (
        <div className="bg-card flex shrink-0 items-center gap-2 border-t px-2 pt-2">
          <div className="border-primary/60 bg-muted min-w-0 flex-1 border-l-2 px-2 py-1">
            <p className="text-[10px] font-medium">Replying to {replyTo.authorName}</p>
            <p className="text-muted-foreground truncate text-xs">{replyTo.content || "Message"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel reply"
            className="text-muted-foreground shrink-0"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <MessageComposer
        value={content}
        onChange={(v, ids) => {
          setContent(v)
          setMentionIds(ids)
        }}
        onSubmit={send}
        members={members}
        uploading={uploading}
        sending={create.isPending}
        recording={recording}
        onRecordingChange={setRecording}
        onFiles={(files, opts) => {
          // A sticker is a one-tap send; anything else gets the review screen.
          if (opts?.asSticker) void upload(files, undefined, undefined, true)
          else setStaged(files)
        }}
        onPoll={() => setCard("poll")}
        onEvent={() => setCard("event")}
        onContact={() => setCard("contact")}
        onVoice={async (blob, durationSec, waveform) => {
          const file = new File([blob], `voice-${durationSec}s.webm`, {
            type: blob.type || "audio/webm",
          })
          await upload([file], durationSec, waveform)
        }}
      />

      {viewingIndex >= 0 && (
        <MediaViewer
          items={gallery}
          index={viewingIndex}
          onIndexChange={(i) => setViewing(gallery[i]?.id ?? null)}
          onClose={() => setViewing(null)}
          urlFor={projectAttachmentUrl}
        />
      )}

      <AttachmentPreview
        files={staged}
        sending={uploading}
        onClose={() => setStaged([])}
        onSend={async (files, caption) => {
          await upload(files, undefined, undefined, false, caption)
          setStaged([])
        }}
      />

      <ForwardDialog
        open={!!forwarding}
        onOpenChange={(o) => !o && setForwarding(null)}
        body={forwarding ?? ""}
      />

      <MessageInfoDialog
        open={!!infoFor}
        onOpenChange={(o) => !o && setInfoFor(null)}
        sentAt={infoFor?.createdAt ?? new Date().toISOString()}
        people={infoFor ? audienceFor(infoFor.authorId) : []}
      />

      <PollComposer
        open={card === "poll"}
        onOpenChange={(o) => setCard(o ? "poll" : null)}
        endpoint={cardEndpoint}
      />
      <EventComposer
        open={card === "event"}
        onOpenChange={(o) => setCard(o ? "event" : null)}
        endpoint={cardEndpoint}
      />
      <ContactComposer
        open={card === "contact"}
        onOpenChange={(o) => setCard(o ? "contact" : null)}
        endpoint={cardEndpoint}
      />

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
  poll,
  event,
  contact,
  onVoted,
  createdAt,
  memberNames,
  onDelete,
  onEdit,
  windowLeft,
  edited,
  opener,
  domId,
  flash,
  startsRun = true,
  delivery,
  onInfo,
  reactions,
  onReact,
  onForward,
  onReply,
  quote,
  onJumpToQuote,
  onOpenMedia,
}: {
  own: boolean
  authorName: string
  photo?: string | null
  firstName: string
  lastName: string
  content: string
  attachments?: Attachment[]
  poll?: PollCardData | null
  event?: EventCardData | null
  contact?: ContactCardData | null
  onVoted?: () => void
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
  /** First bubble of a run by one author: it carries the tail, the avatar,
   *  the name and the gap above. The rest sit tight beneath it. */
  startsRun?: boolean
  /** Read state of YOUR message; omitted on other people's. */
  delivery?: Delivery
  onInfo?: () => void
  reactions?: ReactionGroup[]
  onReact?: (emoji: string) => void
  /** Opens the forward picker with this message's text. */
  onForward?: () => void
  /** Point the composer at this bubble. */
  onReply?: () => void
  /** The line THIS bubble quotes, if any. */
  quote?: { id: string; content: string; authorName: string; fromMe: boolean } | null
  onJumpToQuote?: (id: string) => void
  /** Hands a tapped picture to the thread's conversation-wide viewer. */
  onOpenMedia?: (attachmentId: string) => void
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
        "group flex scroll-mt-4 items-end gap-1.5",
        own ? "flex-row-reverse" : "flex-row",
        startsRun ? "mt-2" : "mt-0.5",
      )}
    >
      {/* One avatar per run, but the gutter is always reserved - without the
          spacer every follow-up bubble would slide left under the avatar. */}
      {!own &&
        (startsRun ? (
          <AvatarDisplay
            src={photo}
            firstName={firstName}
            lastName={lastName}
            size="xs"
            className="mb-4 shrink-0"
          />
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        ))}
      <div
        className={cn(
          "relative max-w-[78%] min-w-0 rounded-sm px-2.5 py-1.5 text-sm shadow-sm",
          own ? BUBBLE_OUT : BUBBLE_IN,
          // Square off the corner the tail grows out of, so the two shapes
          // read as one bubble rather than a blob beside a box.
          startsRun && (own ? "rounded-tr-none" : "rounded-tl-none"),
          flash && "ring-2 ring-amber-400 ring-offset-1",
        )}
      >
        {startsRun && <BubbleTail side={own ? "right" : "left"} />}

        {/* What this answers. Clicking it walks back up the thread - a quote
            you cannot follow is just decoration. */}
        {quote && (
          <button
            type="button"
            onClick={() => onJumpToQuote?.(quote.id)}
            className="border-primary/50 bg-background/50 text-muted-foreground mb-1 block w-full truncate border-l-2 px-1.5 py-0.5 text-left text-[11px]"
          >
            <span className="block font-medium">{quote.fromMe ? "You" : quote.authorName}</span>
            {quote.content || "Message deleted"}
          </button>
        )}

        {/* Only on the first of a run: repeating the name under every line of
            somebody talking to themselves is noise. */}
        {!own && startsRun && (
          <p className="text-primary mb-0.5 text-[11px] font-semibold">{authorName}</p>
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
                  onOpenMedia={onOpenMedia}
                  urlFor={projectAttachmentUrl}
                  avatar={own ? null : { src: photo ?? null, firstName, lastName }}
                />
              </div>
            )}
            {(poll || event || contact) && (
              <div className="mb-1.5">
                <MessageCards
                  poll={poll}
                  event={event}
                  contact={contact}
                  compact
                  onVoted={onVoted}
                />
              </div>
            )}
            {/* A file or card sent with no words of its own gets an auto caption
                so the thread list reads properly - but repeating it under the
                thing it describes is noise. */}
            {!(attachments?.length && AUTO_CAPTIONS.has(content)) &&
              !poll &&
              !event &&
              !contact && (
                <div className="leading-relaxed whitespace-pre-wrap">
                  {renderWithMentions(content, memberNames)}
                </div>
              )}
          </>
        )}
        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1.5 text-[10px]",
            "text-muted-foreground",
          )}
        >
          {edited && <span className="italic">edited</span>}
          {/* Time only - the day is on the separator above this run of messages. */}
          <span>{formatClockTime(createdAt)}</span>
          {/* Ticks on your own only: there is nothing to report about whether YOU
              have read somebody else's message. Clicking opens the full list. */}
          {own && delivery && (
            <button
              type="button"
              onClick={onInfo}
              title="Message info"
              className="hover:text-foreground -my-1 -mr-0.5 p-1 transition-colors"
            >
              <MessageTicks status={delivery} />
              <span className="sr-only">Message info</span>
            </button>
          )}
        </div>

        {reactions && onReact && <MessageReactions reactions={reactions} onToggle={onReact} />}
      </div>

      {/* The same control column personal Chat has: react above, ⋮ below. Edit
          and Delete live INSIDE the menu because they expire - the parent stops
          passing their handlers when the 15 minute window closes, and re-renders
          on a timer so they vanish on their own rather than at the next click. */}
      {!editing && (onReact || onInfo || onReply || onForward || onEdit || onDelete) && (
        <div className="mb-4 flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
          {onReact && <ReactionButton align={own ? "end" : "start"} onPick={onReact} />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Message options"
                className="text-muted-foreground shrink-0"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={own ? "end" : "start"}>
              {/* Own messages only: there is nothing to report about whether YOU
                  have read somebody else's. */}
              {own && onInfo && (
                <DropdownMenuItem onClick={onInfo}>
                  <Info className="mr-2 h-3.5 w-3.5" />
                  Message info
                </DropdownMenuItem>
              )}
              {onReply && (
                <DropdownMenuItem onClick={onReply}>
                  <Reply className="mr-2 h-3.5 w-3.5" />
                  Reply
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => navigator.clipboard?.writeText(content)}
                disabled={!content}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </DropdownMenuItem>
              {onForward && (
                <DropdownMenuItem onClick={onForward} disabled={!content}>
                  <Forward className="mr-2 h-3.5 w-3.5" />
                  Forward
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={startEdit}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                  {windowLeft && (
                    <span className="text-muted-foreground ml-auto pl-3 text-[10px]">
                      {windowLeft}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                  {windowLeft && (
                    <span className="text-muted-foreground ml-auto pl-3 text-[10px]">
                      {windowLeft}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
  return <DayChip label={formatDaySeparator(date)} />
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
