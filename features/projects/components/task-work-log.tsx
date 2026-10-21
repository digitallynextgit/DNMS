"use client"

import * as React from "react"
import { ClipboardList, Link2, Package, Target, Trash2 } from "lucide-react"

import { formatDate } from "@/lib/utils"
import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DateField } from "@/components/shared/date-field"
import { isOpenStatus, type DeliverableStatus } from "../lib/deliverable-lifecycle"
import { isSafeHttpUrl } from "../lib/task-links"
import { serviceInfo } from "../lib/project-services"
import { projectHref } from "../lib/project-href"
import { useTaskWork, useTaskWorkLogMutations } from "../hooks/use-task-work"

/** Today as yyyy-MM-dd in the viewer's own calendar. */
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Where the task sits (goal › deliverable) and what was done on it, day by day. */
export function TaskWorkLog({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskWork(taskId)
  const { add, remove } = useTaskWorkLogMutations(taskId)
  const [day, setDay] = React.useState(localToday)
  const [note, setNote] = React.useState("")
  const [qty, setQty] = React.useState("")
  const [link, setLink] = React.useState("")

  if (isLoading || !data) return null
  const { chain, logs, canLog } = data
  const d = chain.deliverable
  const counting = d !== null && isOpenStatus(d.status as DeliverableStatus)
  const linkOk = link.trim() === "" || isSafeHttpUrl(link.trim())
  const valid = note.trim() !== "" && day !== "" && linkOk

  const save = () => {
    if (!valid || add.isPending) return
    add.mutate(
      {
        workedOn: day,
        note: note.trim(),
        quantity: counting && qty !== "" ? Number(qty) : null,
        links: link.trim() ? [link.trim()] : [],
      },
      {
        onSuccess: () => {
          setNote("")
          setQty("")
          setLink("")
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      {(chain.goal || d) && (
        <div className="text-muted-foreground space-y-1 text-[11px]">
          {chain.goal && (
            <p className="flex items-center gap-1.5">
              <Target className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {chain.goal.parentTitle && `${chain.goal.parentTitle} › `}
                {chain.goal.service &&
                  `${serviceInfo(chain.goal.service)?.name ?? chain.goal.service}: `}
                {chain.project ? (
                  <Link
                    href={projectHref(chain.project, "goals")}
                    className="text-foreground hover:underline"
                    title="Open the goal"
                  >
                    {chain.goal.title}
                  </Link>
                ) : (
                  <span className="text-foreground">{chain.goal.title}</span>
                )}
              </span>
            </p>
          )}
          {d && (
            <p className="flex items-center gap-1.5">
              <Package className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {d.type} ·{" "}
                {chain.project ? (
                  <Link
                    href={projectHref(chain.project, "deliverables", { deliverable: d.id })}
                    className="text-foreground hover:underline"
                    title="Open the deliverable and its tasks"
                  >
                    {d.title}
                  </Link>
                ) : (
                  <span className="text-foreground">{d.title}</span>
                )}{" "}
                ·{" "}
                <span className="tabular-nums">
                  {d.made} of {d.quantity} made
                </span>
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <ClipboardList className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Work log</span>
        <span className="text-muted-foreground text-[11px]">({logs.length})</span>
      </div>

      {canLog && (
        <div className="space-y-2 rounded-sm border p-2.5">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you do? e.g. Made 3 banners, sent for review"
            maxLength={2000}
            rows={2}
            className="text-xs"
            aria-label="What was done"
          />
          <div className="grid grid-cols-[8.5rem_1fr] gap-2">
            {/* modal: the calendar opens over the sheet and has to layer above it. */}
            <DateField value={day} onChange={setDay} placeholder="Day" modal />
            {counting ? (
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={`How many made (of ${d!.quantity - d!.made} left)`}
                className="h-8 text-xs"
                aria-label="How many were made"
              />
            ) : (
              <span />
            )}
          </div>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (optional) - the file, the post, the page"
            className="h-8 text-xs"
            aria-label="Link"
            aria-invalid={!linkOk}
          />
          <div className="flex justify-end">
            <Button
              className="h-7 px-3 text-xs"
              onClick={save}
              disabled={!valid}
              loading={add.isPending}
            >
              Add to log
            </Button>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="group text-xs">
              <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
                <span className="tabular-nums">{formatDate(l.workedOn, "d MMM")}</span>
                <span>{l.employeeName}</span>
                {l.quantity !== null && (
                  <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    +{l.quantity}
                  </span>
                )}
                {l.canDelete && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(l.id)}
                    disabled={remove.isPending}
                    className="hover:text-destructive ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label="Remove this log"
                    title="Remove this log"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{l.note}</p>
              {l.links.map((href) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] underline-offset-4 hover:underline"
                >
                  <Link2 className="h-3 w-3 shrink-0" /> {href}
                </a>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
