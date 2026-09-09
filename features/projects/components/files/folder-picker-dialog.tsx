"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Folder, FolderOpen, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchInput } from "@/components/shared/search-input"
import { cn } from "@/lib/utils"
import type { ProjectFolder } from "../../hooks/use-project-files"

interface Node {
  folder: ProjectFolder
  depth: number
  path: string
}

interface PickerProps {
  folders: ProjectFolder[]
  loading?: boolean
  title?: string
  description?: string
  /** Where the items are now; picking it again is a no-op so the button stays off. */
  currentFolderId: string | null
  /** Folders being moved: they and their sub-folders cannot be the target. */
  excludeFolderIds?: string[]
  submitLabel?: string
  pending?: boolean
  onPick: (folderId: string | null) => void
  onCancel: () => void
}

/**
 * "Move to..." target chooser: the project's folder tree with the top level
 * as the first row. The folders being moved and everything under them are
 * shown but cannot be picked - moving a folder into itself is the one target
 * that can never be right.
 */
export function FolderPickerDialog({
  open,
  onOpenChange,
  ...picker
}: Omit<PickerProps, "onCancel"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Selection state lives in a child that only exists while open, so
            each opening starts at the current folder without an effect. */}
        <PickerBody {...picker} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({
  folders,
  loading = false,
  title = "Move to",
  description,
  currentFolderId,
  excludeFolderIds,
  submitLabel = "Move here",
  pending = false,
  onPick,
  onCancel,
}: PickerProps) {
  const [selected, setSelected] = useState<string | null>(currentFolderId)
  const [query, setQuery] = useState("")

  // Flatten depth-first so the list reads like an indented tree.
  const nodes = useMemo<Node[]>(() => {
    const byParent = new Map<string | null, ProjectFolder[]>()
    for (const f of folders) {
      const list = byParent.get(f.parentId) ?? []
      list.push(f)
      byParent.set(f.parentId, list)
    }
    for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    const out: Node[] = []
    const walk = (parentId: string | null, depth: number, prefix: string) => {
      for (const f of byParent.get(parentId) ?? []) {
        const path = prefix ? `${prefix} / ${f.name}` : f.name
        out.push({ folder: f, depth, path })
        if (depth < 30) walk(f.id, depth + 1, path)
      }
    }
    walk(null, 0, "")
    return out
  }, [folders])

  // The moved folders and all their descendants.
  const blocked = useMemo(() => {
    const set = new Set<string>()
    if (!excludeFolderIds?.length) return set
    const byParent = new Map<string | null, string[]>()
    for (const f of folders) byParent.set(f.parentId, [...(byParent.get(f.parentId) ?? []), f.id])
    const stack = [...excludeFolderIds]
    while (stack.length) {
      const id = stack.pop()!
      if (set.has(id)) continue
      set.add(id)
      stack.push(...(byParent.get(id) ?? []))
    }
    return set
  }, [folders, excludeFolderIds])

  const q = query.trim().toLowerCase()
  const visible = q ? nodes.filter((n) => n.path.toLowerCase().includes(q)) : nodes
  const canSubmit = selected !== currentFolderId && !(selected && blocked.has(selected))

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <SearchInput value={query} onChange={setQuery} placeholder="Search folders..." />

      <div className="max-h-72 overflow-y-auto rounded-sm border" role="listbox">
        {!q && (
          <PickRow
            depth={0}
            icon={Home}
            label="Top level"
            selected={selected === null}
            current={currentFolderId === null}
            onClick={() => setSelected(null)}
          />
        )}
        {loading && folders.length === 0 && (
          <p className="text-muted-foreground px-3 py-4 text-sm">Loading folders...</p>
        )}
        {visible.map((n) => (
          <PickRow
            key={n.folder.id}
            depth={q ? 0 : n.depth + 1}
            icon={selected === n.folder.id ? FolderOpen : Folder}
            label={q ? n.path : n.folder.name}
            selected={selected === n.folder.id}
            current={currentFolderId === n.folder.id}
            disabled={blocked.has(n.folder.id)}
            onClick={() => setSelected(n.folder.id)}
          />
        ))}
        {!loading && visible.length === 0 && q && (
          <p className="text-muted-foreground px-3 py-4 text-sm">No folder matches.</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          loading={pending}
          onClick={() => onPick(selected)}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  )
}

function PickRow({
  depth,
  icon: Icon,
  label,
  selected,
  current,
  disabled,
  onClick,
}: {
  depth: number
  icon: React.ElementType
  label: string
  selected: boolean
  current: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      style={{ paddingLeft: 12 + depth * 16 }}
      className={cn(
        "flex w-full items-center gap-2 py-2 pr-3 text-left text-sm transition-colors",
        selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      {depth > 0 && <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />}
      <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-amber-500")} />
      <span className="truncate">{label}</span>
      {current && <span className="text-muted-foreground ml-auto text-[11px]">current</span>}
    </button>
  )
}
