"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// A chip based list editor. Replaces the "one per line" textareas, which gave no
// feedback about what was actually saved and silently kept blank lines.
// Type and press Enter (or comma) to add, click the x to remove.

export function TagListInput({
  values,
  onChange,
  placeholder,
  /** Normalise each entry as it is added, e.g. strip https:// from a domain. */
  normalize,
  /** Reject an entry with a message instead of adding it. */
  validate,
  max = 50,
  autoFocus,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  normalize?: (raw: string) => string
  validate?: (value: string) => string | null
  max?: number
  autoFocus?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const add = (raw: string) => {
    const cleaned = (normalize ? normalize(raw) : raw).trim()
    if (!cleaned) return
    if (values.length >= max) {
      setError(`Up to ${max} entries.`)
      return
    }
    if (values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      setError("Already in the list.")
      setDraft("")
      return
    }
    const problem = validate?.(cleaned)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setDraft("")
    onChange([...values, cleaned])
  }

  const remove = (value: string) => onChange(values.filter((v) => v !== value))

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          autoFocus={autoFocus}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            // Enter or comma commits. Backspace on an empty box removes the last chip.
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add(draft)
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={placeholder}
          className={cn(error && "border-destructive")}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="bg-muted inline-flex max-w-full items-center gap-1 rounded-sm px-2 py-1 text-xs"
            >
              <span className="truncate" title={v}>
                {v}
              </span>
              <button
                type="button"
                onClick={() => remove(v)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Nothing added yet.</p>
      )}
    </div>
  )
}
