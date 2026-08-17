"use client"

/**
 * Personal chat: conversation list on the left, thread on the right.
 *
 * Realtime comes from ONE EventSource on /api/chat/stream, opened by this
 * component and shared by both panes. Opening a stream per conversation would
 * mean a browser connection per open thread, and browsers cap those at six per
 * origin - the notification stream already uses one of them.
 */

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MessageSquare, Send, Search, Plus, ArrowLeft, MoreVertical, X, Check } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
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
import { EmojiPicker } from "./emoji-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
}

interface Message {
  id: string
  body: string | null
  senderId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  fromMe: boolean
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

export function ChatView() {
  const qc = useQueryClient()
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [picking, setPicking] = React.useState(false)

  const { data, isPending } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () =>
      (
        await apiFetch<{
          data: { data: { conversations: ConversationRow[]; totalUnread: number } }
        }>("/api/chat/conversations")
      ).data.data,
  })

  // ONE stream for the whole screen. Re-render both panes on any event; the
  // queries below own the actual data, so this only has to invalidate.
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

      // Only toast for a thread you are NOT looking at - a toast for the message
      // already on screen is noise.
      if (event.type === "message" && event.conversationId !== activeId && event.senderName) {
        toast.message(event.senderName, { description: event.body?.slice(0, 120) })
      }
    })
    return () => es.close()
  }, [qc, activeId])

  const conversations = data?.conversations ?? []
  const active = conversations.find((c) => c.id === activeId) ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Private one-to-one messages with colleagues"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List. Hidden on mobile once a thread is open, so the thread gets the
            whole screen instead of a 320px column beside it. */}
        <div className={cn("space-y-2", activeId && "hidden lg:block")}>
          {isPending && <Skeleton className="h-64 rounded-md" />}

          {!isPending && conversations.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No conversations"
              description="Start one with a colleague."
              variant="card"
            />
          )}

          <div className="divide-y overflow-hidden rounded-md border">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "hover:bg-muted/60 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                  activeId === c.id && "bg-muted",
                )}
              >
                <AvatarDisplay
                  src={c.other?.profilePhoto ?? null}
                  firstName={c.other?.firstName ?? "?"}
                  lastName={c.other?.lastName ?? ""}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {c.other ? `${c.other.firstName} ${c.other.lastName}` : "Unknown"}
                    </p>
                    {c.lastMessageAt && (
                      <span
                        className="text-muted-foreground shrink-0 text-[10px]"
                        suppressHydrationWarning
                      >
                        {time(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {c.lastMessage
                      ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}`
                      : "No messages yet"}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeId ? (
          <Thread
            conversationId={activeId}
            other={active?.other ?? null}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              icon={MessageSquare}
              title="Pick a conversation"
              description="Or start a new one."
              variant="card"
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
  onBack,
}: {
  conversationId: string
  other: Person | null
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [draft, setDraft] = React.useState("")
  const [editing, setEditing] = React.useState<Message | null>(null)
  const [editDraft, setEditDraft] = React.useState("")
  const endRef = React.useRef<HTMLDivElement>(null)

  const { data, isPending } = useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: { other: Person | null; messages: Message[] } } }>(
          `/api/chat/conversations/${conversationId}/messages`,
        )
      ).data.data,
  })

  const messages = React.useMemo(() => data?.messages ?? [], [data?.messages])
  const person = other ?? data?.other ?? null

  // Opening a thread marks it read; the badge should not survive reading it.
  React.useEffect(() => {
    apiFetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" })
      .then(() => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }))
      .catch(() => {
        /* a failed read-mark is not worth interrupting the user for */
      })
  }, [conversationId, messages.length, qc])

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  const send = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft("")
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] })
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: ({ message, scope }: { message: Message; scope: "me" | "everyone" }) =>
      apiFetch(`/api/chat/messages/${message.id}?scope=${scope}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      // The two outcomes are genuinely different, so say which one happened.
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

  function submit() {
    const body = draft.trim()
    if (!body || send.isPending) return
    send.mutate(body)
  }

  return (
    <div className="bg-card flex h-[70vh] flex-col rounded-md border">
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {isPending && <Skeleton className="h-24 rounded-md" />}
        {!isPending && messages.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-xs">
            No messages yet. Say hello.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "group flex items-end gap-1.5",
              m.fromMe ? "justify-end" : "justify-start",
            )}
          >
            {/* Menu on the outer edge, revealed on hover. Everyone gets "Delete
                for me"; only the author gets Edit and "Delete for everyone". */}
            {!m.deletedAt && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Message options"
                    className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={m.fromMe ? "end" : "start"}>
                  {m.fromMe && (
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(m)
                        setEditDraft(m.body ?? "")
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => remove.mutate({ message: m, scope: "me" })}>
                    Delete for me
                  </DropdownMenuItem>
                  {m.fromMe && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => remove.mutate({ message: m, scope: "everyone" })}
                    >
                      Delete for everyone
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div
              className={cn(
                "max-w-[75%] rounded-lg px-3 py-2",
                m.fromMe ? "bg-primary text-primary-foreground" : "bg-muted",
                m.deletedAt && "opacity-60",
              )}
            >
              {/* Editing happens IN PLACE, in the bubble. A dialog would hide
                  the conversation the wording depends on. */}
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
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Cancel edit"
                      onClick={() => setEditing(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      aria-label="Save edit"
                      disabled={!editDraft.trim() || edit.isPending}
                      onClick={() => edit.mutate({ id: m.id, body: editDraft.trim() })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn("text-sm whitespace-pre-wrap", m.deletedAt && "italic")}>
                  {m.deletedAt ? "Message deleted" : m.body}
                </p>
              )}
              <p
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                  m.fromMe ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
                suppressHydrationWarning
              >
                {time(m.createdAt)}
                {m.editedAt && " · edited"}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-1 border-t p-2.5">
        <EmojiPicker
          onPick={(emoji) => {
            // Appended, not inserted at the caret: a textarea's selection is lost
            // the moment the picker takes focus, so "at the caret" would be a lie.
            setDraft((d) => d + emoji)
          }}
        />
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a newline - the convention every chat
            // app has trained people into.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="max-h-32 min-h-9 resize-none text-sm"
        />
        <Button
          size="icon"
          className="shrink-0"
          disabled={!draft.trim() || send.isPending}
          onClick={submit}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
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

  const { data, isPending } = useQuery({
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
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isPending && <Skeleton className="h-40 rounded-md" />}
          {!isPending && (data ?? []).length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">Nobody matches.</p>
          )}
          {(data ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(p)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors"
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
