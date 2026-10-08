"use client"

// Read receipts, derived from timestamps (the reader's last-read / last-opened mark), not a row per
// message and reader. Exact on "seen", approximate on "when".

import * as React from "react"
import { Check, CheckCheck, Clock, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export type Delivery = "pending" | "sent" | "delivered" | "read"

export function MessageTicks({ status, className }: { status: Delivery; className?: string }) {
  if (status === "pending")
    return <Clock className={cn("h-3 w-3", className)} aria-label="Sending" />
  if (status === "sent") return <Check className={cn("h-3 w-3", className)} aria-label="Sent" />
  return (
    <CheckCheck
      className={cn("h-3 w-3", status === "read" && "text-sky-600 dark:text-sky-400", className)}
      aria-label={status === "read" ? "Read" : "Delivered"}
    />
  )
}

export interface ReceiptPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto?: string | null
  /** When they last opened the conversation. Null = never. */
  seenAt?: string | null
}

/** "Message info": who has seen this and who hasn't. Works for 1:1 and project chats alike. */
export function MessageInfoDialog({
  open,
  onOpenChange,
  sentAt,
  people,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sentAt: string
  /** Everyone it went to, excluding the author. */
  people: ReceiptPerson[]
}) {
  const at = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  // Seen = they opened the conversation AFTER this was sent.
  const sent = new Date(sentAt).getTime()
  const seen = people.filter((p) => p.seenAt && new Date(p.seenAt).getTime() >= sent)
  const notSeen = people.filter((p) => !seen.includes(p))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Message info</DialogTitle>
          <DialogDescription className="text-xs">Sent {at(sentAt)}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-4 overflow-y-auto">
          <ReceiptGroup
            icon={<CheckCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
            label={`Read by ${seen.length}`}
            people={seen}
            at={at}
            empty="Nobody has opened this yet."
          />
          <ReceiptGroup
            icon={<Check className="text-muted-foreground h-3.5 w-3.5" />}
            label={`Not read by ${notSeen.length}`}
            people={notSeen}
            at={at}
            empty="Everyone has read this."
          />
        </div>

        <p className="text-muted-foreground flex gap-1.5 border-t pt-3 text-[11px]">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            The time shown is when that person last opened the conversation, which is how the app
            knows the message was seen - not the moment their eyes reached this line.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptGroup({
  icon,
  label,
  people,
  at,
  empty,
}: {
  icon: React.ReactNode
  label: string
  people: ReceiptPerson[]
  at: (iso: string) => string
  empty: string
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
        {icon}
        {label}
      </p>
      {people.length === 0 ? (
        <p className="text-muted-foreground px-1 text-xs">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5">
              <AvatarDisplay
                src={p.profilePhoto ?? null}
                firstName={p.firstName}
                lastName={p.lastName}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {p.firstName} {p.lastName}
                </p>
                {p.seenAt && (
                  <p className="text-muted-foreground text-[11px]" suppressHydrationWarning>
                    {at(p.seenAt)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
