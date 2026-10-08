"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  MessageSquare,
  Search,
  Plus,
  ArrowLeft,
  MoreVertical,
  X,
  Check,
  Reply,
  Copy,
  Forward,
  Pin,
  PinOff,
  Info,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { SPLIT_PANE_HEADER, SPLIT_PANE_ROW } from "@/lib/constants"
import { dayKey, formatClockTime, formatDaySeparator } from "@/lib/chat-time"
import { BUBBLE_OUT, BUBBLE_IN, BubbleTail, DayChip } from "@/components/shared/chat-bubble"
import {
  MessageTicks,
  MessageInfoDialog,
  type Delivery,
} from "@/components/shared/message-receipts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isWithinEditWindow, editWindowRemaining, formatWindowLeft } from "@/lib/edit-window"
import { HighlightedText, snippet, MIN_SEARCH_QUERY } from "@/components/shared/highlighted-text"
import { MessageComposer } from "@/components/shared/message-composer"
import { MessageAttachments, type Attachment } from "@/components/shared/message-attachments"
import {
  MessageReactions,
  ReactionButton,
  type ReactionGroup,
} from "@/components/shared/message-reactions"
import { EmployeeProfileDialog } from "@/components/shared/employee-profile-dialog"
import { ForwardDialog } from "@/components/shared/forward-dialog"
import { AttachmentPreview } from "@/components/shared/attachment-preview"
import { MediaViewer, type MediaItem } from "@/components/shared/media-viewer"
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

interface Person {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  email?: string
  designation?: string | null
}

interface ConversationRow {
  id: string
  lastMessageAt: string | null
  other: Person | null
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null
  unread: number
  /** Pinned to the top of MY list only. */
  pinnedAt: string | null
}

interface ConversationHit {
  conversationId: string
  other: Person | null
  nameMatch: boolean
  matchCount: number
  matches: { id: string; body: string; createdAt: string; fromMe: boolean }[]
}

interface Message {
  id: string
  body: string | null
  senderId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  deliveredAt: string | null
  pinnedAt: string | null
  poll: PollCardData | null
  event: EventCardData | null
  contact: ContactCardData | null
  replyTo: { id: string; body: string | null; fromMe: boolean } | null
  fromMe: boolean
  attachments: Attachment[]
  reactions: ReactionGroup[]
}

export function ChatView() {
  const qc = useQueryClient()
  // Notifications link to /chat?c=<id>.
  const params = useSearchParams()
  const [activeId, setActiveId] = React.useState<string | null>(params.get("c"))
  const [picking, setPicking] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [jumpTarget, setJumpTarget] = React.useState<string | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () =>
      (
        await apiFetch<{
          data: { data: { conversations: ConversationRow[]; totalUnread: number } }
        }>("/api/chat/conversations")
      ).data.data,
  })

  // A ref, so the SSE effect reads the latest value without re-subscribing.
  const activeIdRef = React.useRef(activeId)
  React.useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  React.useEffect(() => {
    const es = new EventSource("/api/chat/stream")
    es.addEventListener("chat", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as {
        type: string
        conversationId: string
        senderName?: string
        body?: string
      }
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
      qc.invalidateQueries({ queryKey: ["chat", "messages", event.conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "unread-count"] })

      if (
        event.type === "message" &&
        event.conversationId !== activeIdRef.current &&
        event.senderName
      ) {
        toast.message(event.senderName, { description: event.body?.slice(0, 120) })
      }
    })
    return () => es.close()
    // One EventSource for the component's lifetime - do NOT depend on activeId.
  }, [qc])

  const conversations = data?.conversations ?? []
  const active = conversations.find((c) => c.id === activeId) ?? null

  const q = search.trim()
  const searchingAll = q.length >= MIN_SEARCH_QUERY

  const { data: results, isFetching: searchBusy } = useQuery({
    queryKey: ["chat", "search-all", q],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: ConversationHit[] } }>(
          `/api/chat/search?q=${encodeURIComponent(q)}`,
        )
      ).data.data,
    enabled: searchingAll,
  })

  return (
    // h-full, not 100vh: the phone tab bar would push a 100vh pane below the fold.
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Chat"
        description="Private one-to-one messages with colleagues"
        actions={
          <Button className="gap-2" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        }
      />

      <div className="grid min-h-96 flex-1 overflow-hidden rounded-sm border lg:grid-cols-[340px_1fr]">
        <aside
          className={cn("bg-card flex min-h-0 flex-col border-r", activeId && "hidden lg:flex")}
        >
          <div className={cn(SPLIT_PANE_HEADER, "px-2.5")}>
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats and messages"
                aria-label="Search chats and messages"
                className="h-9 rounded-sm pl-8 text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isPending && !searchingAll && (
              <div className="space-y-1 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-sm" />
                ))}
              </div>
            )}

            {q.length > 0 && !searchingAll && (
              <p className="text-muted-foreground p-6 text-center text-xs">Keep typing…</p>
            )}

            {searchingAll && searchBusy && !results && (
              <div className="space-y-1 p-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-sm" />
                ))}
              </div>
            )}

            {searchingAll && results?.length === 0 && (
              <p className="text-muted-foreground p-6 text-center text-xs">
                Nothing matches “{q}”.
              </p>
            )}

            {searchingAll &&
              results?.map((r) => (
                <div key={r.conversationId} className="border-b">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(r.conversationId)
                      setJumpTarget(null)
                    }}
                    className="hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                  >
                    <AvatarDisplay
                      src={r.other?.profilePhoto ?? null}
                      firstName={r.other?.firstName ?? "?"}
                      lastName={r.other?.lastName ?? ""}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {r.other ? `${r.other.firstName} ${r.other.lastName}` : "Unknown"}
                    </span>
                    {r.matchCount > 0 && (
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {r.matchCount} {r.matchCount === 1 ? "message" : "messages"}
                      </span>
                    )}
                  </button>

                  {r.matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveId(r.conversationId)
                        setJumpTarget(m.id)
                      }}
                      className="hover:bg-muted flex w-full flex-col gap-0.5 px-3 py-1.5 pl-12 text-left transition-colors"
                    >
                      <span className="text-muted-foreground text-[10px]">
                        {m.fromMe ? "You" : (r.other?.firstName ?? "Them")} ·{" "}
                        <span suppressHydrationWarning>{formatClockTime(m.createdAt)}</span>
                      </span>
                      <span className="truncate text-xs">
                        <HighlightedText text={snippet(m.body, q)} query={q} />
                      </span>
                    </button>
                  ))}

                  {r.matchCount > r.matches.length && (
                    <p className="text-muted-foreground px-3 pb-1.5 pl-12 text-[10px]">
                      +{r.matchCount - r.matches.length} more in this chat
                    </p>
                  )}
                </div>
              ))}

            {!searchingAll && !isPending && conversations.length === 0 && (
              <p className="text-muted-foreground p-6 text-center text-xs">
                No conversations yet. Start one above.
              </p>
            )}

            {!searchingAll &&
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    SPLIT_PANE_ROW,
                    "hover:bg-muted/60",
                    activeId === c.id && "bg-muted",
                  )}
                >
                  <AvatarDisplay
                    src={c.other?.profilePhoto ?? null}
                    firstName={c.other?.firstName ?? "?"}
                    lastName={c.other?.lastName ?? ""}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1 truncate text-sm font-medium">
                        {c.pinnedAt && (
                          <Pin
                            className="text-muted-foreground h-3 w-3 shrink-0"
                            aria-label="Pinned"
                          />
                        )}
                        <span className="truncate">
                          {c.other ? `${c.other.firstName} ${c.other.lastName}` : "Unknown"}
                        </span>
                      </p>
                      {c.lastMessageAt && (
                        <span
                          className={cn(
                            "shrink-0 text-[10px]",
                            c.unread > 0 ? "text-primary font-medium" : "text-muted-foreground",
                          )}
                          suppressHydrationWarning
                        >
                          {formatClockTime(c.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-muted-foreground truncate text-xs">
                        {c.lastMessage
                          ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                      {c.unread > 0 && (
                        <span className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm px-1.5 text-[10px] font-medium tabular-nums">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </aside>

        {activeId ? (
          <Thread
            key={activeId}
            conversationId={activeId}
            other={active?.other ?? null}
            conversationPinned={!!active?.pinnedAt}
            jumpTarget={jumpTarget}
            onJumped={() => setJumpTarget(null)}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="hidden place-items-center lg:grid">
            <EmptyState
              icon={MessageSquare}
              title="Pick a conversation"
              description="Or start a new one."
            />
          </div>
        )}
      </div>

      <ContactPicker
        open={picking}
        onOpenChange={setPicking}
        onPicked={(id) => {
          setPicking(false)
          setActiveId(id)
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
        }}
      />
    </div>
  )
}

function Thread({
  conversationId,
  other,
  conversationPinned,
  jumpTarget,
  onJumped,
  onBack,
}: {
  conversationId: string
  other: Person | null
  /** Conversation pinned in MY list (not the pinned-messages shelf). */
  conversationPinned: boolean
  jumpTarget?: string | null
  onJumped?: () => void
  onBack: () => void
}) {
  const qc = useQueryClient()

  const pinConversation = useMutation({
    mutationFn: () => apiFetch(`/api/chat/conversations/${conversationId}/pin`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiFetch(`/api/chat/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, emoji }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const [draft, setDraft] = React.useState("")
  const [editing, setEditing] = React.useState<Message | null>(null)
  const [editDraft, setEditDraft] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const [replyTo, setReplyTo] = React.useState<Message | null>(null)
  const [staged, setStaged] = React.useState<File[]>([])
  const [viewing, setViewing] = React.useState<string | null>(null)
  const [infoFor, setInfoFor] = React.useState<Message | null>(null)
  const [forwarding, setForwarding] = React.useState<Message | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [searchQ, setSearchQ] = React.useState("")
  const [flashId, setFlashId] = React.useState<string | null>(null)
  const [profileOpen, setProfileOpen] = React.useState(false)
  // Re-render on a timer so the Edit option disappears when its window closes.
  const [, forceTick] = React.useState(0)
  // Optimistic sends, kept out of the query cache so a failed send can hand the text back.
  const [pending, setPending] = React.useState<{ id: string; body: string; createdAt: string }[]>(
    [],
  )
  const [recording, setRecording] = React.useState(false)
  const [card, setCard] = React.useState<"poll" | "event" | "contact" | null>(null)
  const endRef = React.useRef<HTMLDivElement>(null)

  const { data, isPending } = useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: async () =>
      (
        await apiFetch<{
          data: {
            data: { other: Person | null; otherLastReadAt: string | null; messages: Message[] }
          }
        }>(`/api/chat/conversations/${conversationId}/messages`)
      ).data.data,
  })

  const messages = React.useMemo(() => data?.messages ?? [], [data?.messages])
  const person = other ?? data?.other ?? null

  const gallery = React.useMemo<MediaItem[]>(
    () =>
      messages.flatMap((m) =>
        m.attachments
          .filter((a) => a.kind === "IMAGE" || a.kind === "VIDEO")
          .map((a) => ({
            id: a.id,
            fileName: a.fileName,
            kind: a.kind,
            authorName: m.fromMe
              ? "You"
              : `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim() || "Them",
            authorPhoto: m.fromMe ? null : (person?.profilePhoto ?? null),
            createdAt: m.createdAt,
          })),
      ),
    [messages, person],
  )
  const viewingIndex = viewing ? gallery.findIndex((g) => g.id === viewing) : -1

  const otherReadAtIso = data?.otherLastReadAt ?? null
  const otherReadAt = otherReadAtIso ? new Date(otherReadAtIso).getTime() : 0

  React.useEffect(() => {
    apiFetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
        qc.invalidateQueries({ queryKey: ["chat", "unread-count"] })
        qc.invalidateQueries({ queryKey: ["notifications"] })
      })
      .catch(() => {
        /* a failed read-mark is not worth interrupting the user for */
      })
  }, [conversationId, messages.length, qc])

  React.useEffect(() => {
    // Don't snap to the bottom while jumping to a search hit.
    if (jumpTarget) return
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, pending.length, jumpTarget])

  React.useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 20_000)
    return () => clearInterval(t)
  }, [])

  // Scrolls to the message and fades out the flash its caller set.
  const scrollToMessage = React.useCallback((id: string) => {
    const el = document.getElementById(`chat-msg-${id}`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600)
  }, [])

  const jumpTo = React.useCallback(
    (id: string) => {
      setSearching(false)
      setFlashId(id)
      scrollToMessage(id)
    },
    [scrollToMessage],
  )

  // Wait until the messages exist, or getElementById finds nothing. State flips during render,
  // the scroll waits for the DOM.
  const readyJump = jumpTarget && messages.length > 0 ? jumpTarget : null
  const [prevReadyJump, setPrevReadyJump] = React.useState<string | null>(null)
  if (readyJump !== prevReadyJump) {
    setPrevReadyJump(readyJump)
    if (readyJump) {
      setSearching(false)
      setFlashId(readyJump)
    }
  }
  React.useEffect(() => {
    if (!jumpTarget || messages.length === 0) return
    scrollToMessage(jumpTarget)
    onJumped?.()
  }, [jumpTarget, messages.length, scrollToMessage, onJumped])

  const { data: pinned } = useQuery({
    queryKey: ["chat", "pinned", conversationId],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: { id: string; body: string; fromMe: boolean }[] } }>(
          `/api/chat/conversations/${conversationId}/pinned`,
        )
      ).data.data,
  })

  const trimmedQ = searchQ.trim()
  const { data: hits, isFetching: searchingNow } = useQuery({
    queryKey: ["chat", "search", conversationId, trimmedQ],
    queryFn: async () =>
      (
        await apiFetch<{
          data: { data: { id: string; body: string; fromMe: boolean; createdAt: string }[] }
        }>(`/api/chat/conversations/${conversationId}/search?q=${encodeURIComponent(trimmedQ)}`)
      ).data.data,
    enabled: searching && trimmedQ.length >= MIN_SEARCH_QUERY,
  })

  const pin = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/chat/messages/${id}/pin`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "pinned", conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const send = useMutation({
    mutationFn: (v: { tempId: string; body: string; replyToId?: string }) =>
      apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: v.body, replyToId: v.replyToId }),
      }),
    onSuccess: async (_data, v) => {
      // Drop the placeholder only after the refetch, or the bubble blinks.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] }),
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
      ])
      setPending((list) => list.filter((x) => x.id !== v.tempId))
    },
    onError: (e: Error, v) => {
      setPending((list) => list.filter((x) => x.id !== v.tempId))
      setDraft((d) => d || v.body)
      toast.error(e.message)
    },
  })

  const remove = useMutation({
    mutationFn: ({ message, scope }: { message: Message; scope: "me" | "everyone" }) =>
      apiFetch(`/api/chat/messages/${message.id}?scope=${scope}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      toast.success(v.scope === "me" ? "Hidden from your chat" : "Deleted for everyone")
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/api/chat/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setEditing(null)
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function upload(
    files: File[],
    durationSec?: number,
    waveform?: number[],
    asSticker?: boolean,
    /** Falls back to the composer text (voice notes and stickers). */
    caption?: string,
  ) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const body = (caption ?? draft).trim()
      const form = new FormData()
      for (const f of files) form.append("files", f)
      if (body) form.append("body", body)
      if (durationSec) form.append("durationSec", String(durationSec))
      if (waveform?.length) form.append("waveform", waveform.join(","))
      if (asSticker) form.append("sticker", "1")

      const res = await fetch(`/api/chat/conversations/${conversationId}/attachments`, {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Upload failed")

      setDraft("")
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
      throw e
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    const body = draft.trim()
    if (!body) return
    const tempId = crypto.randomUUID()
    setPending((list) => [...list, { id: tempId, body, createdAt: new Date().toISOString() }])
    setDraft("")
    send.mutate({ tempId, body, replyToId: replyTo?.id })
    setReplyTo(null)
  }

  const cardEndpoint: CardEndpoint = {
    createUrl: `/api/chat/conversations/${conversationId}/cards`,
    invalidate: [
      ["chat", "messages", conversationId],
      ["chat", "conversations"],
    ],
  }

  let lastDay = ""
  // Whose run of messages we are in, so only its first bubble gets a tail.
  let lastMine: boolean | null = null
  const rows: { m: Message; showDay: boolean; startsGroup: boolean }[] = []
  for (const m of messages) {
    const key = dayKey(m.createdAt)
    const showDay = key !== lastDay
    lastDay = key
    rows.push({ m, showDay, startsGroup: showDay || m.fromMe !== lastMine })
    lastMine = m.fromMe
  }
  // The first optimistic send starts a run unless my own message is already the last one.
  const pendingStartsGroup = lastMine !== true

  return (
    // relative: the attachment review screen covers THIS pane, not the viewport.
    <section className="bg-background relative flex min-h-0 flex-col">
      <div className={cn(SPLIT_PANE_HEADER, "bg-card gap-2.5 px-3")}>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <button
          type="button"
          disabled={!person}
          onClick={() => setProfileOpen(true)}
          title={person ? `View ${person.firstName}'s profile` : undefined}
          className="hover:bg-muted -mx-1 flex min-w-0 items-center gap-2.5 rounded-sm px-1 py-0.5 text-left transition-colors disabled:pointer-events-none"
        >
          <AvatarDisplay
            src={person?.profilePhoto ?? null}
            firstName={person?.firstName ?? "?"}
            lastName={person?.lastName ?? ""}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {person ? `${person.firstName} ${person.lastName}` : "Conversation"}
            </p>
            {person?.designation && (
              <p className="text-muted-foreground truncate text-[11px]">{person.designation}</p>
            )}
          </div>
        </button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={conversationPinned ? "Unpin conversation" : "Pin conversation"}
          title={conversationPinned ? "Unpin conversation" : "Pin to top of your chat list"}
          className="text-muted-foreground hover:text-foreground ml-auto shrink-0"
          disabled={pinConversation.isPending}
          onClick={() => pinConversation.mutate()}
        >
          {conversationPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={searching ? "Close search" : "Search in conversation"}
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            setSearching((v) => !v)
            setSearchQ("")
          }}
        >
          {searching ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {searching && (
        <div className="bg-card shrink-0 border-b p-2">
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search in this conversation"
            aria-label="Search in this conversation"
            autoFocus
            className="h-9 text-sm"
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {trimmedQ.length > 0 && trimmedQ.length < MIN_SEARCH_QUERY && (
              <p className="text-muted-foreground px-1 py-2 text-xs">Keep typing…</p>
            )}
            {trimmedQ.length >= MIN_SEARCH_QUERY && searchingNow && (
              <Skeleton className="h-16 rounded-sm" />
            )}
            {trimmedQ.length >= MIN_SEARCH_QUERY && !searchingNow && hits?.length === 0 && (
              <p className="text-muted-foreground px-1 py-2 text-xs">No messages match.</p>
            )}
            {hits?.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => jumpTo(h.id)}
                className="hover:bg-muted w-full rounded-sm px-2 py-1.5 text-left transition-colors"
              >
                <span className="text-muted-foreground block text-[10px]">
                  {h.fromMe ? "You" : (person?.firstName ?? "Them")} ·{" "}
                  {formatClockTime(h.createdAt)}
                </span>
                <span className="block truncate text-xs">
                  <HighlightedText text={snippet(h.body, trimmedQ)} query={trimmedQ} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!searching && pinned && pinned.length > 0 && (
        <div className="bg-muted/40 flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <Pin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {pinned.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => jumpTo(m.id)}
                className="bg-card hover:bg-muted max-w-56 shrink-0 truncate rounded-sm border px-2 py-0.5 text-[11px] transition-colors"
              >
                {m.body || "Message"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isPending && <Skeleton className="h-24 rounded-sm" />}
        {!isPending && messages.length === 0 && pending.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-xs">
            No messages yet. Say hello.
          </p>
        )}

        {rows.map(({ m, showDay, startsGroup }) => {
          const day = formatDaySeparator(m.createdAt)

          const status: Delivery =
            new Date(m.createdAt).getTime() <= otherReadAt
              ? "read"
              : m.deliveredAt
                ? "delivered"
                : "sent"

          return (
            <React.Fragment key={m.id}>
              {showDay && <DayChip label={day} />}

              <div
                className={cn(
                  "group flex items-end gap-1",
                  showDay ? "mt-0" : startsGroup ? "mt-2" : "mt-0.5",
                  m.fromMe ? "justify-end" : "justify-start",
                )}
              >
                {!m.deletedAt && (
                  <div
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100",
                      m.fromMe ? "order-first" : "order-last",
                    )}
                  >
                    <ReactionButton
                      align={m.fromMe ? "end" : "start"}
                      onPick={(emoji) => react.mutate({ messageId: m.id, emoji })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Message options"
                          className="text-muted-foreground shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={m.fromMe ? "end" : "start"}>
                        {m.fromMe && (
                          <DropdownMenuItem onClick={() => setInfoFor(m)}>
                            <Info className="mr-2 h-3.5 w-3.5" />
                            Message info
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setReplyTo(m)}>
                          <Reply className="mr-2 h-3.5 w-3.5" />
                          Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigator.clipboard?.writeText(m.body ?? "")}
                          disabled={!m.body}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setForwarding(m)} disabled={!m.body}>
                          <Forward className="mr-2 h-3.5 w-3.5" />
                          Forward
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => pin.mutate(m.id)}>
                          {m.pinnedAt ? (
                            <>
                              <PinOff className="mr-2 h-3.5 w-3.5" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-3.5 w-3.5" />
                              Pin
                            </>
                          )}
                        </DropdownMenuItem>
                        {m.fromMe &&
                          m.attachments.length === 0 &&
                          isWithinEditWindow(m.createdAt) && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(m)
                                setEditDraft(m.body ?? "")
                              }}
                            >
                              Edit
                              <span className="text-muted-foreground ml-auto pl-3 text-[10px]">
                                {formatWindowLeft(editWindowRemaining(m.createdAt))}
                              </span>
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuItem
                          onClick={() => remove.mutate({ message: m, scope: "me" })}
                        >
                          Delete for me
                        </DropdownMenuItem>
                        {m.fromMe && isWithinEditWindow(m.createdAt) && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => remove.mutate({ message: m, scope: "everyone" })}
                          >
                            Delete for everyone
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <div
                  id={`chat-msg-${m.id}`}
                  className={cn(
                    "relative max-w-[78%] min-w-0 rounded-sm px-2.5 py-1.5 shadow-sm",
                    m.fromMe ? BUBBLE_OUT : BUBBLE_IN,
                    flashId === m.id && "ring-2 ring-amber-400",
                    startsGroup && (m.fromMe ? "rounded-tr-none" : "rounded-tl-none"),
                    m.deletedAt && "opacity-70",
                  )}
                >
                  {startsGroup && <BubbleTail side={m.fromMe ? "right" : "left"} />}

                  {m.replyTo && !m.deletedAt && (
                    <button
                      type="button"
                      onClick={() => jumpTo(m.replyTo!.id)}
                      className={cn(
                        "mb-1 block w-full truncate border-l-2 px-1.5 py-0.5 text-left text-[11px]",
                        m.fromMe
                          ? "border-primary/60 bg-background/50 text-muted-foreground"
                          : "border-primary/50 bg-background/50 text-muted-foreground",
                      )}
                    >
                      <span className="block font-medium">
                        {m.replyTo.fromMe ? "You" : (person?.firstName ?? "Them")}
                      </span>
                      {m.replyTo.body ?? "Message deleted"}
                    </button>
                  )}

                  {editing?.id === m.id ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            if (editDraft.trim()) edit.mutate({ id: m.id, body: editDraft.trim() })
                          }
                          if (e.key === "Escape") setEditing(null)
                        }}
                        rows={2}
                        autoFocus
                        className="bg-background text-foreground min-h-16 resize-none text-sm"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Cancel edit"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          aria-label="Save edit"
                          disabled={!editDraft.trim() || edit.isPending}
                          onClick={() => edit.mutate({ id: m.id, body: editDraft.trim() })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.attachments.length > 0 && (
                        <div className={cn(m.body && "mb-1.5")}>
                          <MessageAttachments
                            attachments={m.attachments}
                            fromMe={m.fromMe}
                            onOpenMedia={setViewing}
                            avatar={
                              m.fromMe || !person
                                ? null
                                : {
                                    src: person.profilePhoto,
                                    firstName: person.firstName,
                                    lastName: person.lastName,
                                  }
                            }
                          />
                        </div>
                      )}
                      {/* Cards carry their own text, so the body preview isn't repeated. */}
                      {(m.poll || m.event || m.contact) && (
                        <div className="mb-1">
                          <MessageCards
                            poll={m.poll}
                            event={m.event}
                            contact={m.contact}
                            compact
                            onVoted={() => {
                              qc.invalidateQueries({
                                queryKey: ["chat", "messages", conversationId],
                              })
                            }}
                          />
                        </div>
                      )}
                      {(m.body || m.deletedAt) && !m.poll && !m.event && !m.contact && (
                        <p
                          className={cn(
                            "text-sm break-words whitespace-pre-wrap",
                            m.deletedAt && "italic",
                          )}
                        >
                          {m.deletedAt ? "Message deleted" : m.body}
                        </p>
                      )}
                    </>
                  )}

                  <p
                    className={cn(
                      "mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none",
                      "text-muted-foreground",
                    )}
                    suppressHydrationWarning
                  >
                    {m.pinnedAt && !m.deletedAt && <Pin className="h-2.5 w-2.5" />}
                    {m.editedAt && !m.deletedAt && <span>edited</span>}
                    {formatClockTime(m.createdAt)}
                    {m.fromMe && !m.deletedAt && (
                      <button
                        type="button"
                        onClick={() => setInfoFor(m)}
                        title="Message info"
                        className="hover:text-foreground -my-1 -mr-0.5 p-1 transition-colors"
                      >
                        <MessageTicks status={status} />
                        <span className="sr-only">Message info</span>
                      </button>
                    )}
                  </p>

                  {!m.deletedAt && (
                    <MessageReactions
                      reactions={m.reactions}
                      onToggle={(emoji) => react.mutate({ messageId: m.id, emoji })}
                    />
                  )}
                </div>
              </div>
            </React.Fragment>
          )
        })}

        {pending.map((item, i) => {
          const startsGroup = i === 0 && pendingStartsGroup
          return (
            <div key={item.id} className={cn("flex justify-end", startsGroup ? "mt-2" : "mt-0.5")}>
              <div
                className={cn(
                  BUBBLE_OUT,
                  "relative max-w-[78%] min-w-0 rounded-sm px-2.5 py-1.5 opacity-75 shadow-sm",
                  startsGroup && "rounded-tr-none",
                )}
              >
                {startsGroup && <BubbleTail side="right" />}
                <p className="text-sm break-words whitespace-pre-wrap">{item.body}</p>
                <p className="text-muted-foreground mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none">
                  <span suppressHydrationWarning>{formatClockTime(item.createdAt)}</span>
                  <MessageTicks status="pending" />
                </p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {replyTo && !recording && (
        <div className="bg-card flex shrink-0 items-center gap-2 border-t px-2 pt-2">
          <div className="border-primary/60 bg-muted min-w-0 flex-1 border-l-2 px-2 py-1">
            <p className="text-[10px] font-medium">
              Replying to {replyTo.fromMe ? "yourself" : (person?.firstName ?? "them")}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {replyTo.body || (replyTo.attachments.length > 0 ? "Attachment" : "Message")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            className="text-muted-foreground shrink-0"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <MessageComposer
        value={draft}
        onChange={(v) => setDraft(v)}
        onSubmit={submit}
        uploading={uploading}
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

      <MessageInfoDialog
        open={!!infoFor}
        onOpenChange={(o) => !o && setInfoFor(null)}
        sentAt={infoFor?.createdAt ?? new Date().toISOString()}
        people={
          person
            ? [
                {
                  id: person.id,
                  firstName: person.firstName,
                  lastName: person.lastName,
                  profilePhoto: person.profilePhoto,
                  seenAt: otherReadAtIso,
                },
              ]
            : []
        }
      />

      {viewingIndex >= 0 && (
        <MediaViewer
          items={gallery}
          index={viewingIndex}
          onIndexChange={(i) => setViewing(gallery[i]?.id ?? null)}
          onClose={() => setViewing(null)}
          urlFor={(id) => `/api/chat/attachments/${id}/file`}
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
        body={forwarding?.body ?? ""}
      />

      <EmployeeProfileDialog
        employeeId={person?.id ?? null}
        open={profileOpen}
        onOpenChange={setProfileOpen}
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
    </section>
  )
}

function ContactPicker({
  open,
  onOpenChange,
  onPicked,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPicked: (conversationId: string) => void
}) {
  const [search, setSearch] = React.useState("")

  const { data, isPending, error } = useQuery({
    queryKey: ["chat", "contacts", search],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: Person[] } }>(
          `/api/chat/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        )
      ).data.data,
    enabled: open,
  })

  const start = useMutation({
    mutationFn: (p: Person) =>
      apiFetch<{ data: { data: { id: string } } }>("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: p.id }),
      }),
    onSuccess: (res) => onPicked(res.data.data.id),
    onError: (e: Error) => toast.error(e.message),
  })

  const people = data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">New chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colleagues"
            aria-label="Search colleagues"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isPending && <Skeleton className="h-40 rounded-sm" />}
          {!isPending && error && (
            <p className="text-destructive py-6 text-center text-xs">
              Could not load colleagues. {error instanceof Error ? error.message : ""}
            </p>
          )}
          {!isPending && !error && people.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">
              {search ? "Nobody matches that search." : "No other active employees found."}
            </p>
          )}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(p)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors"
            >
              <AvatarDisplay
                src={p.profilePhoto}
                firstName={p.firstName}
                lastName={p.lastName}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {p.firstName} {p.lastName}
                </p>
                {p.designation && (
                  <p className="text-muted-foreground truncate text-[11px]">{p.designation}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
