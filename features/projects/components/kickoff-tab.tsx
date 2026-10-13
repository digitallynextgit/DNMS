"use client"

import { useState } from "react"
import { Rocket, StickyNote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDate } from "@/lib/utils"
import type { KickoffItemView } from "@/features/projects/lib/kickoff-template"
import { useProjectKickoff, useSetKickoffItem } from "@/features/projects/hooks/use-kickoff"

export function KickoffTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useProjectKickoff(projectId)
  const save = useSetKickoffItem(projectId)

  if (isError) {
    return (
      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="font-medium">Couldn&apos;t load the kickoff checklist</p>
          <p className="text-muted-foreground text-xs">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-primary text-xs underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const k = data.data
  const pct = k.total === 0 ? 0 : Math.round((k.done / k.total) * 100)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Rocket className="h-4 w-4" /> Pre-campaign must-haves
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                The Account Manager&apos;s checklist before the campaign kicks off. Only you and
                project admins can see it.
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg leading-none font-semibold">
                {k.done}
                <span className="text-muted-foreground text-sm font-normal"> / {k.total}</span>
              </p>
              <p className="text-muted-foreground text-[11px]">{pct}% done</p>
            </div>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {k.sections.map((section, i) => {
        const done = section.items.filter((it) => it.isDone).length
        return (
          <Card key={section.key}>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                  {i + 1}. {section.title}
                </p>
                <span
                  className={cn(
                    "text-[11px]",
                    done === section.items.length ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {done}/{section.items.length}
                </span>
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <KickoffRow
                    key={item.key}
                    item={item}
                    busy={save.isPending && save.variables?.key === item.key}
                    onToggle={(isDone) => save.mutate({ key: item.key, isDone })}
                    onNote={(note) => save.mutate({ key: item.key, note })}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function KickoffRow({
  item,
  busy,
  onToggle,
  onNote,
}: {
  item: KickoffItemView
  busy: boolean
  onToggle: (isDone: boolean) => void
  onNote: (note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? "")
  const id = `kickoff-${item.key}`

  const commit = () => {
    setEditing(false)
    if ((draft.trim() || "") !== (item.note ?? "")) onNote(draft)
  }

  return (
    <li className="hover:bg-muted/40 rounded-sm px-2 py-1.5">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={item.isDone}
          disabled={busy}
          onCheckedChange={(v) => onToggle(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className={cn(
              "cursor-pointer text-sm leading-5",
              item.isDone && "text-muted-foreground line-through",
            )}
          >
            {item.text}
          </label>
          {item.isDone && item.doneBy && (
            <p className="text-muted-foreground text-[11px]">
              Done by {item.doneBy.firstName} {item.doneBy.lastName}
              {item.doneAt ? ` on ${formatDate(item.doneAt)}` : ""}
            </p>
          )}
          {editing ? (
            <Input
              autoFocus
              value={draft}
              placeholder="Note or link to the document (e.g. in Repository)"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") {
                  setDraft(item.note ?? "")
                  setEditing(false)
                }
              }}
              className="mt-1.5 h-8 text-xs"
            />
          ) : item.note ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground mt-0.5 flex items-start gap-1 text-left text-[11px]"
              title="Edit note"
            >
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="break-words">{item.note}</span>
            </button>
          ) : null}
        </div>
        {!editing && !item.note && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [li:hover_&]:opacity-100"
          >
            Add note
          </button>
        )}
      </div>
    </li>
  )
}
