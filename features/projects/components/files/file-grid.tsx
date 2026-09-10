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
 * The item's type icon, which BECOMES its checkbox on hover or once ticked.
 *
 * The two share one 16px slot rather than sitting side by side. A checkbox that
 * is merely `opacity-0` still occupies its place in the row, and that was the
 * permanent empty gap to the left of every name in this grid. Swapping in place
 * also means ticking something shifts nothing.
 *
 * A touch screen has no hover to swap on, so there the checkbox is simply the
 * one showing: losing selection entirely on mobile is the worse trade, and the
 * band heading above already says whether these are folders or files.
 */
function IconOrCheck({
  icon: Icon,
  tint,
  selected,
  onToggle,
  label,
  className,
}: {
  icon: React.ElementType
  tint: string
  selected: boolean
  onToggle: () => void
  label: string
  /** Nudges from the caller. Merged in rather than applied by a wrapper span:
   *  a wrapper is inline, and an inline box ignores the w-4/h-4 this slot is. */
  className?: string
}) {
  return (
    <span className={cn("relative block h-4 w-4 shrink-0", className)}>
      <Icon
        className={cn(
          "absolute inset-0 h-4 w-4 transition-opacity max-sm:opacity-0",
          tint,
          // Not `opacity-0 … selected && opacity-100`: both would be emitted
          // and the winner would depend on utility order, not on this value.
          selected ? "opacity-0" : "opacity-100 group-focus-within:opacity-0 group-hover:opacity-0",
        )}
      />
      <span
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute inset-0 flex items-center transition-opacity max-sm:opacity-100",
          selected
            ? "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={label} />
      </span>
    </span>
  )
}

function FolderTile({ file, selected, onToggle, onOpen, actions }: TileProps) {
  const FolderIcon = TYPE_META.folder.icon
  const count = file.itemCount ?? 0
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openKeys(onOpen)}
      title={file.name}
      className={cn(
        "group bg-muted/50 hover:bg-muted focus-visible:ring-ring flex min-h-16 items-start gap-2.5 rounded-sm px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none",
        selected && "ring-primary bg-muted ring-1",
      )}
    >
      <IconOrCheck
        icon={FolderIcon}
        tint={TYPE_META.folder.tint}
        selected={selected}
        onToggle={onToggle}
        label={`Select ${file.name}`}
        className="mt-0.5"
      />

      <span className="min-w-0 flex-1">
        {/* Two lines before it gives up, so "Festival & Campaign Creatives"
            reads as itself instead of "Festival & ...". */}
        <span className="line-clamp-2 text-sm leading-snug font-medium break-words">
          {file.name}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[11px] tabular-nums">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </span>

      <span onClick={(e) => e.stopPropagation()} className="-mt-1 -mr-1.5 shrink-0">
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
        <IconOrCheck
          icon={Icon}
          tint={meta.tint}
          selected={selected}
          onToggle={onToggle}
          label={`Select ${file.name}`}
        />
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
          {/* One column fewer than the file cards: a folder is a NAME, and six
              across left every name too narrow to be one. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
