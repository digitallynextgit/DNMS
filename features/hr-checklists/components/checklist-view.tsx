"use client"

import * as React from "react"
import { toast } from "sonner"

import { ChecklistItemRow } from "./checklist-item-row"
import { ChecklistProgressBar } from "./checklist-progress-bar"
import { SignClearanceDialog } from "./sign-clearance-dialog"
import { useSetItemDone } from "../hooks/use-checklists"
import type { ChecklistDetail, ChecklistItem } from "../types"

/**
 * The checklist itself: items grouped under the document's own step headings,
 * in template order.
 *
 * Grouping is done from `sectionTitle` on the items rather than from a
 * relation, because the instance is a snapshot - the heading a leaver's
 * clearance was filed under has to keep reading the way it did on the day, even
 * after HR renames that step in the template.
 */
export function ChecklistView({
  checklist,
  currentUserId,
}: {
  checklist: ChecklistDetail
  currentUserId: string
}) {
  const setDone = useSetItemDone()
  const [signing, setSigning] = React.useState<ChecklistItem | null>(null)

  const sections = React.useMemo(() => {
    const bySection = new Map<string, ChecklistItem[]>()
    for (const item of checklist.items) {
      const list = bySection.get(item.sectionTitle)
      if (list) list.push(item)
      else bySection.set(item.sectionTitle, [item])
    }
    return [...bySection.entries()]
  }, [checklist.items])

  const isClosed = checklist.status !== "IN_PROGRESS"

  /** Whether this viewer may tick this item, and if not, why. */
  function permission(item: ChecklistItem): { canTick: boolean; reason?: string } {
    if (isClosed) return { canTick: false, reason: "This checklist is closed" }
    if (item.assigneeId === currentUserId) return { canTick: true }
    if (checklist.canWrite) return { canTick: true }
    if (item.itemKind === "CLEARANCE") {
      return {
        canTick: false,
        reason: item.assignee
          ? `${item.assignee.firstName} ${item.assignee.lastName} signs this`
          : "HR signs this",
      }
    }
    return { canTick: false, reason: "Assigned to somebody else" }
  }

  function toggle(item: ChecklistItem, done: boolean) {
    // Signing a clearance asks for a note first: the note is the evidence -
    // "laptop returned, asset tag DN-114" - and is what makes the sign-off
    // worth more than a tick. Unticking, and ordinary tasks, go straight through.
    if (done && item.itemKind === "CLEARANCE") {
      setSigning(item)
      return
    }
    setDone.mutate(
      { itemId: item.id, done },
      { onError: () => toast.error("Could not update that item") },
    )
  }

  return (
    <div className="space-y-4">
      <ChecklistProgressBar progress={checklist.progress} />

      {sections.map(([title, items]) => (
        <section key={title} className="overflow-hidden rounded-sm border">
          <header className="bg-muted/50 border-b px-3 py-2">
            <h3 className="text-xs font-medium">{title}</h3>
          </header>
          <div className="divide-y">
            {items.map((item) => {
              const { canTick, reason } = permission(item)
              return (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  canTick={canTick}
                  disabledReason={reason}
                  isPending={setDone.isPending}
                  onToggle={(done) => toggle(item, done)}
                />
              )
            })}
          </div>
        </section>
      ))}

      <SignClearanceDialog
        item={signing}
        onOpenChange={(open) => !open && setSigning(null)}
        onSigned={() => setSigning(null)}
      />
    </div>
  )
}
