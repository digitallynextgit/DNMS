"use client"

import { useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { cn } from "@/lib/utils"
import type { ProjectMember } from "../hooks/use-projects"

const memberLabel = (m: ProjectMember) => `${m.firstName} ${m.lastName}`.trim()

/**
 * A <Textarea> with an @mention picker. Typing "@" opens a list of project
 * members; picking one inserts "@Full Name " and records their id. The set of
 * ids still referenced by an "@Name" token in the text is reported back via
 * onChange, so deleting the text also drops the mention.
 */
export function MentionTextarea({
  value,
  onChange,
  members,
  rows = 5,
  placeholder,
  autoFocus,
  id,
  initialMentions,
}: {
  value: string
  onChange: (value: string, mentionIds: string[]) => void
  members: ProjectMember[]
  rows?: number
  placeholder?: string
  autoFocus?: boolean
  id?: string
  /** Seed already-known mentions (e.g. when restoring a recalled draft) so their
   *  "@Name" tokens keep resolving to ids without the user re-picking them. */
  initialMentions?: { id: string; label: string }[]
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Everyone ever picked in this editor; the live mention set is derived by
  // checking which "@Label" tokens still survive in the text.
  const pickedRef = useRef<{ id: string; label: string }[]>(
    initialMentions ? [...initialMentions] : [],
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [atIndex, setAtIndex] = useState(-1)
  const [active, setActive] = useState(0)

  const liveMentionIds = (text: string) => {
    const ids = new Set<string>()
    for (const p of pickedRef.current) {
      if (text.includes(`@${p.label}`)) ids.add(p.id)
    }
    return [...ids]
  }

  const suggestions = useMemo(() => {
    if (!open) return []
    const q = query.trim().toLowerCase()
    const list = q ? members.filter((m) => memberLabel(m).toLowerCase().includes(q)) : members
    return list.slice(0, 6)
  }, [open, query, members])

  function detectTrigger(text: string, caret: number) {
    // Walk back from the caret to the nearest "@" that starts a word.
    const before = text.slice(0, caret)
    const at = before.lastIndexOf("@")
    if (at === -1) return { open: false, at: -1, query: "" }
    const prev = at > 0 ? before[at - 1] : " "
    const startsWord = prev === " " || prev === "\n" || prev === "\t"
    const token = before.slice(at + 1)
    // A mention token is a short run without a newline or another "@".
    if (!startsWord || /[\n@]/.test(token) || token.length > 30) {
      return { open: false, at: -1, query: "" }
    }
    return { open: true, at, query: token }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    const caret = e.target.selectionStart ?? text.length
    const trig = detectTrigger(text, caret)
    setOpen(trig.open)
    setQuery(trig.query)
    setAtIndex(trig.at)
    setActive(0)
    onChange(text, liveMentionIds(text))
  }

  function pick(member: ProjectMember) {
    const el = textareaRef.current
    if (!el || atIndex < 0) return
    const label = memberLabel(member)
    const tokenEnd = atIndex + 1 + query.length
    const next = `${value.slice(0, atIndex)}@${label} ${value.slice(tokenEnd)}`
    if (!pickedRef.current.some((p) => p.id === member.id && p.label === label)) {
      pickedRef.current.push({ id: member.id, label })
    }
    setOpen(false)
    setQuery("")
    setAtIndex(-1)
    onChange(next, liveMentionIds(next))
    // Restore focus + place caret right after the inserted mention.
    const caret = atIndex + 1 + label.length + 1
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      pick(suggestions[active] ?? suggestions[0])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {open && suggestions.length > 0 && (
        <div className="bg-popover absolute z-50 mt-1 w-72 overflow-hidden rounded-md border shadow-md">
          <p className="text-muted-foreground border-b px-2.5 py-1.5 text-[11px]">
            Mention a team member
          </p>
          <ul className="max-h-56 overflow-y-auto py-1">
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so it fires before the textarea's blur.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(m)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                    i === active ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <AvatarDisplay
                    src={m.profilePhoto}
                    firstName={m.firstName}
                    lastName={m.lastName}
                    size="xs"
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {memberLabel(m)}
                    {m.designation?.title && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        · {m.designation.title}
                      </span>
                    )}
                  </span>
                  {m.isManager && (
                    <span className="text-muted-foreground shrink-0 text-[10px]">Manager</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Renders message text with @mentions highlighted. A run "@First Last" is
 * highlighted when it matches one of the project member names.
 */
export function renderWithMentions(text: string, memberNames: Set<string>) {
  if (memberNames.size === 0) return text
  // Sort longest-first so "@Anna Maria Smith" wins over "@Anna".
  const names = [...memberNames].sort((a, b) => b.length - a.length)
  const parts: (string | { mention: string })[] = []
  let rest = text
  outer: while (rest.length > 0) {
    const at = rest.indexOf("@")
    if (at === -1) {
      parts.push(rest)
      break
    }
    if (at > 0) parts.push(rest.slice(0, at))
    const afterAt = rest.slice(at + 1)
    for (const name of names) {
      if (afterAt.startsWith(name)) {
        parts.push({ mention: `@${name}` })
        rest = afterAt.slice(name.length)
        continue outer
      }
    }
    // A lone "@" that isn't a known member - keep it as text and move on.
    parts.push("@")
    rest = afterAt
  }
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span
        key={i}
        className="text-primary bg-primary/10 dark:bg-primary/20 rounded px-1 font-medium"
      >
        {p.mention}
      </span>
    ),
  )
}
