"use client"

/**
 * The Repository's card view - the Google Drive layout: folders first as a
 * row of compact tiles, then files as thumbnail cards.
 *
 * It renders the SAME rows the table does (already filtered, sorted and paged
 * by the tab) and reuses the tab's own open/actions handlers, so the two views
 * can never drift apart on what a click does or who may do it.
 */
import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { subtitleOf, TYPE_LABEL, type UnifiedFile } from "../../lib/file-row"
import { PersonCell, StorageCell, TagChip, TYPE_META, TYPE_WASH } from "./file-bits"

interface TileProps {
  file: UnifiedFile
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  actions: React.ReactNode
  /** Preview image, when one could be resolved. */
  thumb?: string
}

/** Enter/Space open the item, matching what a click on the tile does. */
function openKeys(onOpen: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    onOpen()
  }
}

/**
 * A checkbox that stays out of the way until it is useful: hidden until the
 * tile is hovered or focused, and pinned visible once ticked. Always visible
 * on touch screens, which have no hover to reveal it with.
 */
function SelectBox({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex shrink-0 items-center transition-opacity",
        // Not `opacity-0 … selected && opacity-100`: both would be emitted and
        // the winner would depend on utility order, not on this condition.
        selected
          ? "opacity-100"
          : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100",
      )}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label="Select item" />
    </span>
  )
}

function FolderTile({ file, selected, onToggle, onOpen, actions }: TileProps) {
  const FolderIcon = TYPE_META.folder.icon
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openKeys(onOpen)}
      title={file.name}
      className={cn(
        "group bg-muted/50 hover:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-sm px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:outline-none",
        selected && "ring-primary bg-muted ring-1",
      )}
    >
      <SelectBox selected={selected} onToggle={onToggle} />
      <FolderIcon className={cn("h-4 w-4 shrink-0", TYPE_META.folder.tint)} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
        {file.itemCount ?? 0}
      </span>
      <span onClick={(e) => e.stopPropagation()} className="-mr-1.5 shrink-0">
        {actions}
      </span>
    </div>
  )
}

function GridCard({ file, selected, onToggle, onOpen, actions, thumb }: TileProps) {
  const meta = TYPE_META[file.type]
  const Icon = meta.icon
  // A signed thumbnail expires, and Drive can refuse one outright. Either way
  // the card falls back to its type icon rather than showing a broken image.
  const [broken, setBroken] = useState(false)
  const showThumb = !!thumb && !broken

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openKeys(onOpen)}
      title={file.source === "link" ? file.url : file.name}
      className={cn(
        "group bg-card focus-visible:ring-ring overflow-hidden rounded-sm border text-left transition-shadow focus-visible:ring-2 focus-visible:outline-none",
        "hover:border-primary/40 hover:shadow-sm",
        selected && "border-primary/50 ring-primary ring-1",
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <SelectBox selected={selected} onToggle={onToggle} />
        <Icon className={cn("h-4 w-4 shrink-0", meta.tint)} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
        <span onClick={(e) => e.stopPropagation()} className="-mr-1.5 shrink-0">
          {actions}
        </span>
      </div>

      <div
        className={cn(
          "flex aspect-4/3 items-center justify-center overflow-hidden border-y",
          !showThumb && TYPE_WASH[file.type],
        )}
      >
        {showThumb ? (
          // Signed B2 URLs and Drive thumbnails are per-file and short-lived,
          // so next/image (which would proxy and cache them) is the wrong tool.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <Icon className={cn("h-9 w-9 opacity-40", meta.tint)} />
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]">
        {file.tag ? (
          <TagChip tag={file.tag} muted={!file.tagIsStored} />
        ) : (
          <span className="truncate">{subtitleOf(file)}</span>
        )}
        <span className="ml-auto shrink-0">
          {file.modified
            ? new Date(file.modified).toLocaleDateString("en-IN")
            : TYPE_LABEL[file.type]}
        </span>
      </div>
    </div>
  )
}

/** Section heading, matching Drive's small grey labels above each band. */
function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold">{label}</h3>
      {children}
    </section>
  )
}

export function FileGrid({
  rows,
  isSelected,
  onToggle,
  onOpen,
  actions,
  thumbs,
}: {
  rows: UnifiedFile[]
  isSelected: (f: UnifiedFile) => boolean
  onToggle: (f: UnifiedFile) => void
  onOpen: (f: UnifiedFile) => void
  actions: (f: UnifiedFile) => React.ReactNode
  /** Row id -> preview image URL, for the rows that have one. */
  thumbs: Map<string, string>
}) {
  const folders = rows.filter((f) => f.source === "folder")
  const files = rows.filter((f) => f.source !== "folder")

  return (
    <div className="space-y-5">
      {folders.length > 0 && (
        <Band label="Folders">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {folders.map((f) => (
              <FolderTile
                key={f.id}
                file={f}
                selected={isSelected(f)}
                onToggle={() => onToggle(f)}
                onOpen={() => onOpen(f)}
                actions={actions(f)}
              />
            ))}
          </div>
        </Band>
      )}

      {files.length > 0 && (
        <Band label={folders.length > 0 ? "Files" : "Items"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((f) => (
              <div key={`${f.source}-${f.id}`} className="space-y-1">
                <GridCard
                  file={f}
                  selected={isSelected(f)}
                  onToggle={() => onToggle(f)}
                  onOpen={() => onOpen(f)}
                  actions={actions(f)}
                  thumb={thumbs.get(f.id)}
                />
                <div className="text-muted-foreground flex items-center gap-2 px-1 text-[11px]">
                  <PersonCell p={f.addedBy} compact />
                  <span className="ml-auto shrink-0">
                    <StorageCell f={f} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Band>
      )}
    </div>
  )
}
