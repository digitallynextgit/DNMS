"use client"

/**
 * Forward a message to a colleague's personal chat.
 *
 * One destination on purpose: "send this to someone" is what forwarding is for,
 * and a personal chat is the one place every employee can be reached from both
 * message surfaces. Forwarding into another project thread would need the
 * project picked first, and forwarding to a project you are not on is not a
 * thing the API would allow anyway.
 *
 * No new endpoint: it opens (or reuses) the conversation and posts the text,
 * exactly as the New chat picker and the composer already do. Attachments are
 * NOT carried - the file lives behind a membership-checked route, so passing it
 * on means re-uploading it into the other conversation, which is a different
 * feature and is called out in the UI rather than silently half-done.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, SendHorizonal } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { SearchInput } from "@/components/shared/search-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Colleague {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation?: string | null
}

export function ForwardDialog({
  open,
  onOpenChange,
  /** The text being forwarded. Empty/attachment-only messages are refused. */
  body,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  body: string
}) {
  const [search, setSearch] = React.useState("")

  const { data, isPending } = useQuery({
    queryKey: ["chat", "contacts", search],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: Colleague[] } }>(
          `/api/chat/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        )
      ).data.data,
    enabled: open,
  })

  const forward = useMutation({
    mutationFn: async (person: Colleague) => {
      // Open-or-reuse first: the endpoint is idempotent by pair, so forwarding to
      // someone you already talk to lands in the existing thread.
      const convo = await apiFetch<{ data: { data: { id: string } } }>("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: person.id }),
      })
      await apiFetch(`/api/chat/conversations/${convo.data.data.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      return person
    },
    onSuccess: (person) => {
      toast.success(`Forwarded to ${person.firstName}`)
      onOpenChange(false)
      setSearch("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const people = data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Forward to</DialogTitle>
          <DialogDescription className="text-xs">
            Sends the text as a new message in your chat with them. Files and voice notes are not
            carried over.
          </DialogDescription>
        </DialogHeader>

        <SearchInput value={search} onChange={setSearch} placeholder="Search colleagues" />

        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {isPending && (
            <p className="text-muted-foreground flex items-center gap-2 px-1 py-4 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading colleagues…
            </p>
          )}
          {!isPending && people.length === 0 && (
            <p className="text-muted-foreground px-1 py-4 text-xs">No colleagues match.</p>
          )}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={forward.isPending}
              onClick={() => forward.mutate(p)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors disabled:opacity-50"
            >
              <AvatarDisplay
                src={p.profilePhoto}
                firstName={p.firstName}
                lastName={p.lastName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.firstName} {p.lastName}
                </p>
                {p.designation && (
                  <p className="text-muted-foreground truncate text-[11px]">{p.designation}</p>
                )}
              </div>
              {forward.isPending && forward.variables?.id === p.id ? (
                <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <SendHorizonal className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
