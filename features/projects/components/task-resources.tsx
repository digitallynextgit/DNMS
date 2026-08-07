"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Link as LinkIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCommitOnOutsidePointer } from "@/hooks/use-commit-on-outside-pointer"
import { dedupeLinks, isSafeHttpUrl, linkLabel } from "@/features/projects/lib/task-links"

/**
 * A task's resource links - the brief, the doc, the published page.
 *
 * Shared by the sheet's Resources column and the card list, so a link behaves
 * the same wherever it is seen: the same chips, the same editor, the same rule
 * about what counts as a link. Built as one component rather than copied into
 * both because the validation is the part that must not drift.
 *
 * Owns its own editing state; the caller only supplies the current links, says
 * whether editing is allowed, and receives the committed list.
 */
export function TaskResources({
  links,
  canEdit,
  onCommit,
  className,
}: {
  links: string[]
  canEdit: boolean
  onCommit: (links: string[]) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  // One string per row. A textarea let two 100-character URLs wrap into one
  // unbroken wall with nothing marking where the first ended; a row each gives
  // every link its own box, and its own line, however long it is.
  const [draft, setDraft] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const settled = useRef(false)

  // Blur alone misses a click on a scrollbar or on a target that prevents its
  // own mousedown. finish() is idempotent, so both paths can be wired up.
  useCommitOnOutsidePointer(boxRef, editing, () => finish(true))

  function begin() {
    if (!canEdit) return
    settled.current = false
    // Always a trailing blank row, so there is somewhere to type the next link
    // without hunting for an "add" button first.
    setDraft([...links, ""])
    setEditing(true)
  }

  /** Keep exactly one empty row at the end as rows are filled in. */
  function editRow(i: number, value: string) {
    setDraft((rows) => {
      const next = rows.map((v, j) => (j === i ? value : v))
      if (next[next.length - 1]?.trim()) next.push("")
      return next
    })
  }

  function removeRow(i: number) {
    setDraft((rows) => {
      const next = rows.filter((_, j) => j !== i)
      return next.length > 0 ? next : [""]
    })
  }

  function finish(save: boolean) {
    if (settled.current) return
    settled.current = true
    setEditing(false)
    if (!save) return
    const next = dedupeLinks(draft)
    // Say which row is wrong before sending. The API rejects it too, but a
    // toast naming the bad URL beats a generic failure after the round trip.
    const bad = next.find((l) => !isSafeHttpUrl(l))
    if (bad) {
      toast.error(`"${bad}" is not a web link`, {
        description: "Resources must start with http:// or https://",
      })
      return
    }
    if (next.join("\n") === links.join("\n")) return
    onCommit(next)
  }

  if (editing) {
    return (
      <span ref={boxRef} className={cn("flex min-w-0 flex-col gap-1", className)}>
        {draft.map((url, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {/* A single-line input, so a long URL scrolls sideways inside its
                own box instead of wrapping over six lines into the next one. */}
            <input
              value={url}
              autoFocus={i === draft.length - 1}
              onChange={(e) => editRow(i, e.target.value)}
              onBlur={() => {
                // Only when focus leaves the editor entirely - moving between
                // rows must not commit half a list.
                window.setTimeout(() => {
                  if (!boxRef.current?.contains(document.activeElement)) finish(true)
                }, 0)
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  settled.current = true
                  setEditing(false)
                  return
                }
                if (e.key === "Enter") {
                  e.preventDefault()
                  finish(true)
                }
              }}
              className="border-border focus:border-primary min-w-0 flex-1 rounded-[2px] border bg-transparent px-1 py-0.5 text-[10px] outline-none"
              placeholder="https://…"
              aria-label={`Resource ${i + 1}`}
            />
            {draft.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label={`Remove resource ${i + 1}`}
                className="text-muted-foreground/50 hover:text-destructive shrink-0 rounded-[2px] outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {links.map((url, i) => (
        // stopPropagation: the chip opens the link, the space around it may open
        // an editor. Without it, following a link would also do that.
        <a
          // Index in the key, not the url alone: rows saved before duplicates
          // were collapsed still hold two of the same, and they have to render
          // rather than collide on their key.
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          onClick={(e) => e.stopPropagation()}
          className="bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1 rounded-[2px] px-1 py-0.5 text-[10px] transition-colors"
        >
          <LinkIcon className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{linkLabel(url)}</span>
        </a>
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            begin()
          }}
          className="text-muted-foreground/40 hover:text-foreground focus-visible:ring-primary/60 rounded-[2px] px-0.5 text-[10px] outline-none focus-visible:ring-2"
          aria-label={links.length > 0 ? "Edit resources" : "Add a resource link"}
        >
          {links.length > 0 ? "edit" : "add…"}
        </button>
      )}
      {!canEdit && links.length === 0 && <span className="text-muted-foreground/40">–</span>}
    </span>
  )
}
