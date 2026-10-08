"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TASK_WORKFLOW_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants"
import {
  TaskStatusReasonDialog,
  type TaskStatusPayload,
} from "@/features/projects/components/task-status-reason-dialog"

export type { TaskStatusPayload }

/** "On Hold" and "Discarded" ask for a reason first; other statuses commit immediately. */
export function TaskStatusSelect({
  value,
  onCommit,
  disabled,
  triggerClassName,
}: {
  value: string
  onCommit: (payload: TaskStatusPayload) => void
  disabled?: boolean
  triggerClassName?: string
}) {
  const [pending, setPending] = React.useState<null | "ON_HOLD" | "DISCARDED">(null)

  // Keep a legacy current status (IN_REVIEW / CANCELLED) so it still renders as selected.
  const options = React.useMemo(() => {
    const set = [...TASK_WORKFLOW_STATUSES] as string[]
    if (!set.includes(value)) set.unshift(value)
    return set
  }, [value])

  function handleChange(next: string) {
    if (next === value) return
    if (next === "ON_HOLD" || next === "DISCARDED") {
      setPending(next)
      return
    }
    onCommit({ status: next })
  }

  return (
    <>
      <Select value={value} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {TASK_STATUS_LABELS[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TaskStatusReasonDialog
        mode={pending}
        onOpenChange={(o) => !o && setPending(null)}
        onConfirm={(payload) => {
          onCommit(payload)
          setPending(null)
        }}
      />
    </>
  )
}
