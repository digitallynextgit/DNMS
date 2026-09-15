"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"

import { FormDialog } from "@/components/shared/form-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSetItemDone } from "../hooks/use-checklists"
import type { ChecklistItem } from "../types"

/**
 * Signing off a clearance.
 *
 * A note is asked for rather than required. Requiring one would get "ok" typed
 * into it a thousand times, which is worse than nothing because it looks like
 * evidence. Prompting gets the useful half - the asset tag, the settled
 * advance - from the people who have something to record.
 */
export function SignClearanceDialog({
  item,
  onOpenChange,
  onSigned,
}: {
  item: ChecklistItem | null
  onOpenChange: (open: boolean) => void
  onSigned: () => void
}) {
  const [note, setNote] = React.useState("")
  const [noteFor, setNoteFor] = React.useState<string | null>(null)
  const setDone = useSetItemDone()

  // Clear the note when the dialog moves to a different item. Adjusted DURING
  // RENDER rather than in an effect: an effect would paint the previous
  // signer's note for one frame and cost a second render every time the dialog
  // opens. React re-runs this component immediately without committing, which
  // is the documented way to reset state on a prop change.
  if (item && noteFor !== item.id) {
    setNoteFor(item.id)
    setNote("")
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!item) return
    setDone.mutate({ itemId: item.id, done: true, note: note.trim() }, { onSuccess: onSigned })
  }

  return (
    <FormDialog
      open={!!item}
      onOpenChange={onOpenChange}
      title="Sign this clearance"
      description={item?.text}
      submitLabel="Sign off"
      isPending={setDone.isPending}
      onSubmit={submit}
      size="sm"
    >
      <div className="space-y-3">
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-sm p-3 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            {item?.helpText ??
              "Confirm there is nothing outstanding from your department for this person."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clearance-note">Note (optional)</Label>
          <Textarea
            id="clearance-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth recording - asset tags returned, dues settled."
            rows={3}
            maxLength={500}
          />
        </div>
      </div>
    </FormDialog>
  )
}
