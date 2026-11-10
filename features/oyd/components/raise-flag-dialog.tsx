"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormDialog } from "@/components/shared/form-dialog"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { OYD_CATEGORIES, OYD_CATEGORY_KEYS, OYD_NOTE_MAX } from "../constants"
import { useOydPeople, useRaiseFlag } from "../hooks/use-oyd"
import type { OydCategory } from "../types"

export function RaiseFlagDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: people = [], isPending: loadingPeople } = useOydPeople(open)
  const raise = useRaiseFlag()

  const [employeeId, setEmployeeId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<OydCategory>("MISSED_DEADLINE")
  const [note, setNote] = React.useState("")

  const q = query.trim().toLowerCase()
  const matches = people
    .filter(
      (p) =>
        !q || `${p.firstName} ${p.lastName ?? ""} ${p.employeeNo ?? ""}`.toLowerCase().includes(q),
    )
    .slice(0, 40)
  const picked = people.find((p) => p.id === employeeId)
  const valid = Boolean(employeeId) && note.trim().length >= 5

  function reset() {
    setEmployeeId(null)
    setQuery("")
    setCategory("MISSED_DEADLINE")
    setNote("")
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!employeeId) return
    raise.mutate(
      { employeeId, category, note: note.trim() },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="Raise an OYD flag"
      description="For a missed deadline or a delay that held up your work."
      isPending={raise.isPending}
      submitDisabled={!valid}
      submitLabel="Raise flag"
      onSubmit={submit}
    >
      <div className="space-y-2">
        <Label required>Who is it for?</Label>
        <Input
          placeholder="Search by name or employee no."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="border-border max-h-48 overflow-y-auto rounded-sm border">
          {loadingPeople && <p className="text-muted-foreground p-3 text-sm">Loading…</p>}
          {!loadingPeople && matches.length === 0 && (
            <p className="text-muted-foreground p-3 text-sm">No one matches.</p>
          )}
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEmployeeId(p.id)}
              className={cn(
                "hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                employeeId === p.id && "bg-accent",
              )}
            >
              <AvatarDisplay
                src={p.profilePhoto}
                firstName={p.firstName}
                lastName={p.lastName ?? ""}
                size="sm"
              />
              <span className="truncate">
                {p.firstName} {p.lastName}
              </span>
              <span className="text-muted-foreground ml-auto text-xs">{p.employeeNo}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label required>What happened?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {OYD_CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "rounded-sm border px-3 py-2 text-left transition-colors",
                category === key ? "border-primary bg-primary/5" : "hover:bg-accent",
              )}
            >
              <span className="block text-sm font-medium">{OYD_CATEGORIES[key].label}</span>
              <span className="text-muted-foreground block text-xs">
                {OYD_CATEGORIES[key].hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label required htmlFor="oyd-note">
          Note
        </Label>
        <Textarea
          id="oyd-note"
          rows={4}
          maxLength={OYD_NOTE_MAX}
          placeholder="What was due, when, and how the delay affected the work"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {picked && (
        <p className="text-muted-foreground bg-muted/40 rounded-sm px-3 py-2 text-xs">
          {picked.confirmsAtOnce
            ? `This counts right away. ${picked.firstName} gets the mail from you, with HR and their Reporting Manager in Cc.`
            : `HR or ${picked.firstName}'s Reporting Manager confirms it first. Once confirmed, ${picked.firstName} gets the mail from you, with HR and their Reporting Manager in Cc.`}
        </p>
      )}
    </FormDialog>
  )
}
