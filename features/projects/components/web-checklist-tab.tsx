"use client"

import { useState } from "react"
import { ListChecks, StickyNote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import {
  WEB_CHECKLIST_STATUSES,
  WEB_CHECKLIST_STATUS_LABELS,
  type WebChecklistItemView,
  type WebChecklistStatus,
} from "@/features/projects/lib/web-checklist-template"
import {
  useProjectWebChecklist,
  useSetWebChecklistItem,
} from "@/features/projects/hooks/use-web-checklist"

const STATUS_DOT: Record<WebChecklistStatus, string> = {
  NOT_STARTED: "bg-muted-foreground/40",
  DONE: "bg-emerald-500",
  NOT_APPLICABLE: "bg-slate-300 dark:bg-slate-600",
}

export function WebChecklistTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useProjectWebChecklist(projectId)
  const save = useSetWebChecklistItem(projectId)

  if (isError) {
    return (
      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="font-medium">Couldn&apos;t load the web analytics checklist</p>
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

  if (isLoading || !data) return <Skeleton className="h-80 w-full" />

  const c = data.data
  const done = c.counts.DONE
  const pct = c.applicable === 0 ? 100 : Math.round((done / c.applicable) * 100)

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <ListChecks className="h-4 w-4" /> Web analytics checklist
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Mark tools that don&apos;t apply to this project as Not applicable so they leave the
              count.
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg leading-none font-semibold">
              {done}
              <span className="text-muted-foreground text-sm font-normal"> / {c.applicable}</span>
            </p>
            <p className="text-muted-foreground text-[11px]">{pct}% done</p>
          </div>
        </div>
        <Progress value={pct} />
        <ul className="space-y-1">
          {c.items.map((item) => (
            <ChecklistRow
              key={item.key}
              item={item}
              busy={save.isPending && save.variables?.key === item.key}
              onStatus={(status) => save.mutate({ key: item.key, status })}
              onNote={(note) => save.mutate({ key: item.key, note })}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ChecklistRow({
  item,
  busy,
  onStatus,
  onNote,
}: {
  item: WebChecklistItemView
  busy: boolean
  onStatus: (status: WebChecklistStatus) => void
  onNote: (note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? "")

  const commit = () => {
    setEditing(false)
    if ((draft.trim() || "") !== (item.note ?? "")) onNote(draft)
  }

  return (
    <li className="hover:bg-muted/40 rounded-sm px-2 py-1.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_DOT[item.status])}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm leading-5",
              item.status === "DONE" && "text-muted-foreground",
              item.status === "NOT_APPLICABLE" && "text-muted-foreground line-through",
            )}
          >
            {item.text}
          </p>
          {item.status !== "NOT_STARTED" && item.statusAt && (
            <p className="text-muted-foreground text-[11px]">
              {WEB_CHECKLIST_STATUS_LABELS[item.status]}
              {item.statusBy ? ` · ${item.statusBy.firstName} ${item.statusBy.lastName}` : ""}
              {` · ${formatDate(item.statusAt)}`}
            </p>
          )}
          {editing ? (
            <Input
              autoFocus
              value={draft}
              placeholder="Note, ID or link (e.g. G-XXXXXXX, GTM-XXXXXX)"
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
            className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0 text-[11px] opacity-0 transition-opacity focus:opacity-100 [li:hover_&]:opacity-100"
          >
            Add note
          </button>
        )}
        <Select
          value={item.status}
          disabled={busy}
          onValueChange={(v) => {
            if (v !== item.status) onStatus(v as WebChecklistStatus)
          }}
        >
          <SelectTrigger
            className="h-8 w-[170px] shrink-0 text-xs"
            aria-label={`Status of ${item.text}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEB_CHECKLIST_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                  {WEB_CHECKLIST_STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  )
}
