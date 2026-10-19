"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { nameKey } from "../../lib/file-names"

export interface NameConflict {
  /** Caller's id for the item (an index into the upload batch, or "new"). */
  key: string
  name: string
  suggested: string
}

export type NameConflictChoice =
  | { mode: "cancel" }
  | { mode: "skip" }
  | { mode: "keep" }
  | { mode: "rename"; names: Record<string, string> }

export interface NameConflictRequest {
  conflicts: NameConflict[]
  /** "file", "folder" or "link" - for the wording. */
  noun: string
  /** Where they would land, e.g. "Brochures" or "the top level". */
  where: string
  /** The verb on the buttons: Upload, Create, Rename, Save. */
  action: string
  /** Name keys already in the folder, so an edited name can be checked too. */
  taken: ReadonlySet<string>
  /** Uploads only: go ahead with the other files and leave these out. */
  canSkip?: boolean
}

/** Asks what to do when a name is already used in the folder: rename (suggested), keep it, or skip. */
export function NameConflictDialog({
  request,
  onChoose,
}: {
  request: NameConflictRequest | null
  onChoose: (choice: NameConflictChoice) => void
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && onChoose({ mode: "cancel" })}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each request starts from its own suggestions. */}
        {request && <ConflictForm request={request} onChoose={onChoose} />}
      </DialogContent>
    </Dialog>
  )
}

function ConflictForm({
  request,
  onChoose,
}: {
  request: NameConflictRequest
  onChoose: (choice: NameConflictChoice) => void
}) {
  const { conflicts, noun, where, action, taken, canSkip } = request
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.key, c.suggested])),
  )
  const many = conflicts.length > 1

  // An edited name must be free in the folder and not repeat another new name.
  const problemOf = (key: string): string | null => {
    const value = (names[key] ?? "").trim()
    if (!value) return "Enter a name"
    if (taken.has(nameKey(value))) return "This name is also taken here"
    const repeats = conflicts.some(
      (c) => c.key !== key && nameKey(names[c.key] ?? "") === nameKey(value),
    )
    return repeats ? "Two of the new names are the same" : null
  }
  const valid = conflicts.every((c) => problemOf(c.key) === null)
  const rename = () => {
    if (valid) {
      onChoose({
        mode: "rename",
        names: Object.fromEntries(conflicts.map((c) => [c.key, names[c.key]!.trim()])),
      })
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        rename()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {many
            ? `${conflicts.length} names are already used`
            : `A ${noun} with this name already exists`}
        </DialogTitle>
        <DialogDescription>
          {many
            ? `These names are already in ${where}.`
            : `"${conflicts[0]!.name}" is already in ${where}.`}{" "}
          Give {many ? "them new names" : "it a new name"}, or keep the same name.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto py-4">
        {conflicts.map((c, i) => {
          const problem = problemOf(c.key)
          return (
            <div key={c.key} className="space-y-1">
              {many && (
                <p className="text-muted-foreground truncate text-xs" title={c.name}>
                  {c.name}
                </p>
              )}
              <Input
                aria-label={`New name for ${c.name}`}
                autoFocus={i === 0}
                value={names[c.key] ?? ""}
                maxLength={255}
                onChange={(e) => setNames((n) => ({ ...n, [c.key]: e.target.value }))}
                onFocus={(e) => {
                  // Select the name, not the extension, as file managers do.
                  const v = e.target.value
                  const dot = v.lastIndexOf(".")
                  e.target.setSelectionRange(0, noun === "file" && dot > 0 ? dot : v.length)
                }}
                aria-invalid={problem !== null}
              />
              {problem && <p className="text-destructive text-xs">{problem}</p>}
            </div>
          )
        })}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => onChoose({ mode: "cancel" })}>
          Cancel
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {canSkip && (
            <Button type="button" variant="outline" onClick={() => onChoose({ mode: "skip" })}>
              Skip {many ? "these" : "this one"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onChoose({ mode: "keep" })}>
            Keep same name{many ? "s" : ""}
          </Button>
          <Button type="submit" disabled={!valid}>
            {action} with new name{many ? "s" : ""}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
