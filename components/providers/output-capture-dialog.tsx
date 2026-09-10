"use client"

import * as React from "react"
import { useSession } from "next-auth/react"

import { apiFetch } from "@/lib/api-fetch"
import { useOutputCaptureStore } from "@/stores/output-capture-store"
import { DeliverableFormDialog } from "@/features/projects/components/deliverable-form-dialog"
import { useProjectDeliverables } from "@/features/projects/hooks/use-deliverables"

/**
 * The one capture dialog, mounted in the dashboard shell.
 *
 * Opens when a task flagged as producing output is marked done with nothing
 * logged against it. The form arrives prefilled from the task - title, links,
 * who made it, when it started, and the task link itself - so it is a
 * confirmation, not a form.
 *
 * TWO SHAPES, ONE DIALOG. With nothing owed it is "what did it produce?" and a
 * fresh row. With a row already PLANNED against the task it is "is this the one
 * we promised?" and that row is marked delivered - which is what stops a promise
 * and its delivery becoming two entries in the ledger.
 *
 * Cancel is "nothing came out of this", and that is a perfectly good answer: it
 * records the skip on the task so the nudge, the amber label and the digest all
 * stop asking. Answering a PLANNED prompt with cancel just closes - the promise
 * is still owed, and skipping it would be a lie.
 *
 * After the first save the form stays open in edit mode so files can be
 * attached; closing then, or at any point, advances to the next queued prompt.
 */
export function OutputCaptureDialog() {
  const pending = useOutputCaptureStore((s) => s.pending)
  const dismiss = useOutputCaptureStore((s) => s.dismiss)
  const { data: session } = useSession()
  const [editingId, setEditingId] = React.useState<string | null>(null)

  // The chosen project's ledger: type suggestions, and the saved row once the
  // first step is done (so files can be attached to it).
  const ledger = useProjectDeliverables(pending?.projectId, {})
  // The owed rows, which the default ledger filters out - fetched only when this
  // prompt actually names one.
  const owed = useProjectDeliverables(pending?.planned ? pending.projectId : undefined, {
    status: ["PLANNED", "IN_PROGRESS"],
  })

  if (!pending || !session?.user?.id) return null

  const plannedId = pending.planned?.id ?? null
  const plannedRow = plannedId ? (owed.data?.rows.find((r) => r.id === plannedId) ?? null) : null
  // The prompt named a promise but the ledger has not arrived yet. Nothing is
  // shown rather than a blank "log something new" form that would duplicate it.
  if (plannedId && !plannedRow && !editingId) return null

  // Once something has been saved THAT is the row being edited; before then it
  // is the promise, if there was one. Confirming a promise DELIVERS that row
  // rather than logging a second one beside it - hence submitStatus below; a
  // fresh log is DELIVERED by default anyway, so it needs neither prop.
  const saved = editingId ? (ledger.data?.rows.find((r) => r.id === editingId) ?? null) : null
  const entry = saved ?? plannedRow

  return (
    <DeliverableFormDialog
      key={`${pending.taskId}:${editingId ?? plannedId ?? "new"}`}
      projectId={pending.projectId}
      open
      onOpenChange={(o) => {
        if (o) return
        // Closing with nothing logged and nothing owed IS the answer: this task
        // produced nothing. Recorded so the task stops being chased. Fire and
        // forget - a failed skip costs one more nudge, and blocking the close on
        // it would be worse.
        if (!editingId && !plannedId) {
          void apiFetch(`/api/tasks/${pending.taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outputSkipped: true }),
          }).catch(() => {})
        }
        setEditingId(null)
        dismiss()
      }}
      entry={entry}
      onCreated={(id, count) => count === 1 && setEditingId(id)}
      canManage={false}
      currentUserId={pending.employeeId ?? session.user.id}
      suggestedTypes={ledger.data?.suggestedTypes ?? []}
      initial={{
        title: pending.title,
        links: pending.links,
        taskId: pending.taskId,
        startedOn: pending.startedOn,
      }}
      submitStatus={plannedId ? "DELIVERED" : undefined}
      submitLabel={plannedId ? "Mark delivered" : undefined}
      prompt={
        plannedId
          ? "You marked this done. Is this the deliverable that was planned for it?"
          : "You marked this done. What did it produce?"
      }
    />
  )
}
