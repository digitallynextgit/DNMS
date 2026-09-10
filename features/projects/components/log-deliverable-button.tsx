"use client"

import * as React from "react"
import { PackageCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProjectDeliverables } from "../hooks/use-deliverables"
import { DeliverableFormDialog } from "./deliverable-form-dialog"

// ─────────────────────────────────────────────────────────────────────────────
// "Log what you delivered", from wherever you already are.
//
// The Deliverables tab is a project's ledger; this is the one-click entry point
// for the person doing the work, placed on My Tasks so logging output is part
// of the same visit as updating tasks rather than a trip to the project page.
// One project on the list opens the form directly; more than one asks which
// first.
// ─────────────────────────────────────────────────────────────────────────────

export function LogDeliverableButton({
  projects,
  currentUserId,
  className,
}: {
  /** Projects this person works on - derived from their tasks, so it is never
   *  a project they cannot log against. */
  projects: { id: string; name: string }[]
  currentUserId: string
  className?: string
}) {
  const [picking, setPicking] = React.useState(false)
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const unique = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const p of projects) m.set(p.id, p.name)
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  // The chosen project's ledger, for type suggestions and to find the row after
  // the first save (the dialog flips to edit mode so files can be attached).
  const ledger = useProjectDeliverables(projectId ?? undefined, {})
  const entry = ledger.data?.rows.find((r) => r.id === editingId) ?? null

  const start = () => {
    if (unique.length === 1) {
      setProjectId(unique[0]!.id)
      setEditingId(null)
      setFormOpen(true)
    } else {
      setPicking(true)
    }
  }

  if (unique.length === 0) return null

  return (
    <>
      <Button variant="outline" className={className} onClick={start}>
        <PackageCheck className="h-3.5 w-3.5" />
        Log what you delivered
      </Button>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Which project?</DialogTitle>
            <DialogDescription>The deliverable is logged against one client.</DialogDescription>
          </DialogHeader>
          <Select value={projectId ?? undefined} onValueChange={setProjectId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {unique.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
            <Button
              disabled={!projectId}
              onClick={() => {
                setPicking(false)
                setEditingId(null)
                setFormOpen(true)
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {projectId && (
        <DeliverableFormDialog
          key={`${projectId}:${editingId ?? "new"}`}
          projectId={projectId}
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o)
            if (!o) setEditingId(null)
          }}
          entry={entry}
          onCreated={(id, count) => count === 1 && setEditingId(id)}
          canManage={false}
          currentUserId={currentUserId}
          suggestedTypes={ledger.data?.suggestedTypes ?? []}
        />
      )}
    </>
  )
}
