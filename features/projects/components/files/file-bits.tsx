"use client"

/**
 * The small pieces the Repository's table view and card grid both draw: the
 * type icon set, the tag chip, the person cell and the storage badge. Kept
 * here so neither view owns them and the two stay identical.
 */
import { FileText, Folder, Link2, Sheet as SheetIcon } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { TONE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { DOC_TAG_LABEL, DOC_TAG_STYLE, type DocTag } from "../../lib/doc-tag"
import type { FileType, Person, UnifiedFile } from "../../lib/file-row"

/** Icon + tint per type; the label lives in `lib/file-row.ts` (`TYPE_LABEL`). */
export const TYPE_META: Record<FileType, { icon: React.ElementType; tint: string }> = {
  doc: { icon: FileText, tint: "text-blue-500" },
  sheet: { icon: SheetIcon, tint: "text-emerald-500" },
  pdf: { icon: FileText, tint: "text-red-500" },
  image: { icon: FileText, tint: "text-violet-500" },
  folder: { icon: Folder, tint: "text-amber-500" },
  link: { icon: Link2, tint: "text-sky-500" },
  other: { icon: FileText, tint: "text-muted-foreground" },
}

/** Soft background behind a big type icon, for cards with no thumbnail. */
export const TYPE_WASH: Record<FileType, string> = {
  doc: "bg-blue-500/5",
  sheet: "bg-emerald-500/5",
  pdf: "bg-red-500/5",
  image: "bg-violet-500/5",
  folder: "bg-amber-500/5",
  link: "bg-sky-500/5",
  other: "bg-muted/40",
}

const SOURCE_COLORS: Record<string, string> = { B2: TONE.blue, DRIVE: TONE.emerald }
const SOURCE_LABELS: Record<string, string> = { B2: "Backblaze", DRIVE: "Drive" }

export const iconBtn =
  "text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-sm"

export function TagChip({ tag, muted }: { tag: DocTag; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        DOC_TAG_STYLE[tag],
        // A derived tag is shown at reduced weight: it is a guess about a file
        // we do not own a row for, and it cannot be corrected here.
        muted && "opacity-60",
      )}
    >
      {DOC_TAG_LABEL[tag]}
    </span>
  )
}

export function PersonCell({ p, compact }: { p: Person | null; compact?: boolean }) {
  if (!p) return <span className="text-muted-foreground">-</span>
  const size = compact ? "h-5 w-5" : "h-6 w-6"
  return (
    <span className="flex min-w-0 items-center gap-2" title={p.name}>
      {p.photo ? (
        // Profile photos come from our own storage with per-user URLs, so a
        // plain img is fine here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />
      ) : (
        <span
          className={cn(
            size,
            "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          )}
        >
          {p.initials}
        </span>
      )}
      <span className="truncate">{p.name}</span>
    </span>
  )
}

export function StorageCell({ f }: { f: UnifiedFile }) {
  if (f.source === "folder") return <span className="text-muted-foreground">-</span>
  if (f.source === "link") {
    return (
      <span className="inline-flex items-center rounded-sm bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-600 uppercase dark:text-sky-400">
        Link
      </span>
    )
  }
  return (
    <StatusBadge
      status={f.source === "b2" ? "B2" : "DRIVE"}
      colorMap={SOURCE_COLORS}
      labelMap={SOURCE_LABELS}
      size="xs"
    />
  )
}
