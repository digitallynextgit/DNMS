"use client"

import * as React from "react"
import { Pencil, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeliverableMutations, type DeliverableRow } from "../hooks/use-deliverables"
import { MAX_QUANTITY, MAX_TYPE_LENGTH } from "../lib/deliverable-types"
import { formatPeriod } from "../lib/delivery-period"

// ─────────────────────────────────────────────────────────────────────────────
// Editing one item of a deliverable.
//
// THE SAME THREE FIELDS THE ITEM WAS PLANNED WITH, in the same row: an item is
// created as "type · what is it · how many", and the ordinary edit is fixing
// one of those three. The old route here was the full log form - team, person,
// dates, repeat, task, goal, links, notes, files - which asks thirteen
// questions to change a word.
//
// Assigning is its own action in the table, and the link or file a delivered
// item carries goes on at the moment it is logged, in the log form.
// ─────────────────────────────────────────────────────────────────────────────

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

export function EditItemDialog({
  projectId,
  row,
  onClose,
}: {
  /** The ref the board is keyed by - a slug or an id. NOT row.projectId, which
   *  is always the id and would invalidate a cache entry nobody is reading. */
  projectId: string
  /** The item being edited. Null closes the dialog. */
  row: DeliverableRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {/* Body only exists while open, so every opening seeds from the row. */}
        {row && <Body projectId={projectId} row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  projectId,
  row,
  onClose,
}: {
  projectId: string
  row: DeliverableRow
  onClose: () => void
}) {
  const m = useDeliverableMutations(projectId)
  const [type, setType] = React.useState(row.type)
  const [title, setTitle] = React.useState(row.title)
  // A string, not a number: an emptied box while somebody retypes is a normal
  // state, and coercing it to 0 mid-keystroke fights the person typing.
  const [quantity, setQuantity] = React.useState(String(row.quantity))

  const qty = Math.max(1, Math.min(Number(quantity) || 1, MAX_QUANTITY))
  const valid = type.trim().length > 0 && title.trim().length > 0

  const period =
    row.periodStart && row.periodEnd ? formatPeriod(day(row.periodStart), day(row.periodEnd)) : null
  const context = [row.team?.name, period].filter(Boolean).join(" · ")

  const save = () => {
    if (!valid) return
    m.update.mutate(
      { id: row.id, type: type.trim(), title: title.trim(), quantity: qty },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Edit item
        </DialogTitle>
        <DialogDescription>
          What it is, and how many of it. Everything else about this item is unchanged.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        {context && (
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground h-3.5 w-3.5" />
            <h4 className="text-sm font-semibold">{context}</h4>
          </div>
        )}
        {/* The same grid the plan wizard lays a new item out in, so editing one
            and creating one look like the same act. */}
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_72px]">
          <Input
            value={type}
            maxLength={MAX_TYPE_LENGTH}
            onChange={(e) => setType(e.target.value)}
            placeholder="Reel, Blog, Banner…"
            aria-label="Type"
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it?"
            aria-label="Title"
          />
          <Input
            type="number"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label="How many"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={m.update.isPending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!valid} loading={m.update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
