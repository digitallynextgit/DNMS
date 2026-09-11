"use client"

import * as React from "react"
import { FileText, Link2, PackageCheck, Paperclip, Trash2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/shared/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeliverableMutations, type DeliverableRow } from "../hooks/use-deliverables"
import { MAX_LINKS } from "../lib/deliverable-types"
import { isSafeHttpUrl, linkLabel } from "../lib/task-links"

// ─────────────────────────────────────────────────────────────────────────────
// Logging work as it happens - which is NOT declaring the thing delivered.
//
// "4 blogs" is one row, but the work arrives one blog at a time. This records
// what is finished so far and the proof of it; the row stays in progress and
// the status menu only offers Delivered once the count reaches the promise.
// Merging the two made the first blog unloggable without claiming all four.
//
// FILES UPLOAD IMMEDIATELY, links save with the row - the shape of the
// endpoints, not a preference: a file needs a row to hang off, and this row
// already exists. The slot a file came from is remembered HERE, in local
// state, because the server holds a deliverable's files as a set with no
// notion of which unit they belong to. Re-opening therefore shows them as
// extras below rather than back in their slots, which is the honest thing to
// do with a mapping that was never stored.
// ─────────────────────────────────────────────────────────────────────────────

/** Cap on rendered slots. A row may promise 999 units; nobody fills 999 boxes. */
const MAX_SLOTS = MAX_LINKS

interface Slot {
  key: string
  link: string
  /** Id of a file uploaded from this slot, resolved against `row.files`. */
  fileId: string | null
  uploading: boolean
}

const emptySlot = (i: number): Slot => ({ key: `s${i}`, link: "", fileId: null, uploading: false })

export function LogWorkDialog({
  projectId,
  row,
  onClose,
}: {
  /** The ref the board is keyed by - a slug or an id, not row.projectId. */
  projectId: string
  /** The item being worked on. Null closes the dialog. */
  row: DeliverableRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Body only exists while open, so every opening seeds from the row. */}
        {row && <Body projectId={projectId} row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  projectId,
  row,
  onClose,
}: {
  projectId: string
  row: DeliverableRow
  onClose: () => void
}) {
  const m = useDeliverableMutations(projectId)
  const fileInput = React.useRef<HTMLInputElement>(null)
  // Which slot the file picker was opened from, so the upload lands back in it.
  const pickingFor = React.useRef<string | null>(null)

  const [slots, setSlots] = React.useState<Slot[]>(() => {
    const want = Math.max(1, Math.min(row.quantity, MAX_SLOTS))
    return Array.from({ length: want }, (_, i) => ({
      ...emptySlot(i),
      // Re-opening shows what was said last time rather than a blank sheet.
      link: row.links[i] ?? "",
    }))
  })

  const setSlot = (key: string, patch: Partial<Slot>) =>
    setSlots((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const fileById = (id: string | null) => (id ? (row.files.find((f) => f.id === id) ?? null) : null)
  const boundIds = new Set(slots.map((s) => s.fileId).filter(Boolean) as string[])
  /** Files on the row that no slot claims - earlier uploads, or a re-open. */
  const looseFiles = row.files.filter((f) => !boundIds.has(f.id))

  // The third kind of proof. Plenty of real work leaves neither a URL nor a
  // file - a call made, a budget moved, a page checked - and since Delivered
  // now REQUIRES proof, without this those items could never be finished.
  const [note, setNote] = React.useState(row.notes ?? "")

  const links = slots.map((s) => s.link.trim()).filter((l) => l.length > 0)
  const badLink = links.some((l) => !isSafeHttpUrl(l))
  const answered =
    slots.filter((s) => s.link.trim() || s.fileId).length +
    looseFiles.length +
    // A note covers the item it describes, so it counts as one answered.
    (note.trim() && !slots.some((s) => s.link.trim() || s.fileId) && looseFiles.length === 0
      ? 1
      : 0)

  // How many are FINISHED, which is not always how many boxes have something in
  // them: one link can cover two blogs, and a draft plus its published page is
  // two proofs of one. So the count follows the boxes until somebody says
  // otherwise, and then it is theirs.
  const [touched, setTouched] = React.useState(false)
  const [raw, setRaw] = React.useState(String(row.deliveredQuantity))
  const auto = Math.min(Math.max(answered, row.deliveredQuantity), row.quantity)
  const done = touched ? Math.max(0, Math.min(Number(raw) || 0, row.quantity)) : auto
  const complete = done >= row.quantity
  /** Delivered is refused without one of the three. Mirrors the server gate. */
  const hasAnyProof = links.length > 0 || row.files.length > 0 || note.trim().length > 0

  const busy = m.update.isPending || slots.some((s) => s.uploading)

  const pick = (key: string) => {
    pickingFor.current = key
    fileInput.current?.click()
  }

  const onPicked = async (file: File | undefined) => {
    const key = pickingFor.current
    pickingFor.current = null
    if (!file || !key) return
    setSlot(key, { uploading: true })
    try {
      const res = (await m.upload.mutateAsync({ id: row.id, file })) as { data?: { id?: string } }
      setSlot(key, { uploading: false, fileId: res?.data?.id ?? null })
    } catch {
      // The mutation already told them why; just release the slot.
      setSlot(key, { uploading: false })
    }
  }

  const submit = () => {
    if (badLink) return
    m.update.mutate(
      {
        id: row.id,
        links,
        notes: note.trim() || null,
        deliveredQuantity: done,
        // Work has started, so say so. Only from PLANNED: any other status is
        // already past this point, and REJECTED must stay put until it is
        // redelivered.
        ...(row.status === "PLANNED" && done > 0 ? { status: "IN_PROGRESS" as const } : {}),
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4" />
          Log work
        </DialogTitle>
        <DialogDescription>
          {row.type} · {row.title} - {row.quantity} {row.quantity === 1 ? "unit" : "units"}
          {row.team ? ` for ${row.team.name}` : ""}. Record what is finished so far; the rest can
          follow.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Finished so far</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={row.quantity}
                value={touched ? raw : String(auto)}
                onChange={(e) => {
                  setTouched(true)
                  setRaw(e.target.value)
                }}
                aria-label="How many are finished"
                className="w-20"
              />
              <span className="text-muted-foreground text-sm">of {row.quantity}</span>
            </div>
          </div>
          <span
            className={cn(
              "pb-2 text-[11px] tabular-nums",
              complete && hasAnyProof ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {complete && !hasAnyProof
              ? "Add a link, a file or a note before this can be delivered"
              : complete
                ? "All done - you can mark it delivered from Status"
                : `${row.quantity - done} still to go`}
          </span>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-[11px]">Proof</Label>

          {slots.map((s, i) => {
            const file = fileById(s.fileId)
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                  {i + 1}
                </span>
                {file ? (
                  <span className="border-border bg-muted/40 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border px-3">
                    <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm hover:underline"
                    >
                      {file.fileName}
                    </a>
                  </span>
                ) : (
                  <Input
                    value={s.link}
                    onChange={(e) => setSlot(s.key, { link: e.target.value })}
                    placeholder="Paste a link…"
                    aria-label={`Proof ${i + 1}`}
                    aria-invalid={s.link.trim().length > 0 && !isSafeHttpUrl(s.link.trim())}
                    className="flex-1"
                  />
                )}
                {s.uploading ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <Spinner className="h-3.5 w-3.5" />
                  </span>
                ) : file ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    title="Remove this file"
                    disabled={busy}
                    onClick={() => {
                      m.removeFile.mutate(file.id)
                      setSlot(s.key, { fileId: null })
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Attach a file for ${i + 1}`}
                    title="Attach a file instead"
                    disabled={busy || s.link.trim().length > 0}
                    onClick={() => pick(s.key)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}

          {badLink && (
            <p className="text-destructive text-[11px]">
              A link has to start with http:// or https://
            </p>
          )}

          {row.quantity > MAX_SLOTS && (
            <p className="text-muted-foreground text-[11px]">
              Showing {MAX_SLOTS} of {row.quantity} - one link can cover the rest.
            </p>
          )}

          {slots.length < MAX_SLOTS && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setSlots((ss) => [...ss, emptySlot(ss.length)])}
            >
              <Link2 className="h-3.5 w-3.5" /> Another
            </Button>
          )}
        </div>

        {/* Files already on the row that no slot above claims. */}
        {looseFiles.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Also attached</Label>
            <ul className="space-y-1">
              {looseFiles.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {f.fileName}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    disabled={busy}
                    onClick={() => m.removeFile.mutate(f.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Third proof type. Last, because a link or a file is better evidence
            when one exists - this is for the work that produces neither. */}
        <div className="space-y-1.5">
          <Label htmlFor="log-note" className="text-muted-foreground text-[11px]">
            Note {links.length === 0 && row.files.length === 0 ? "" : "(optional)"}
          </Label>
          <Textarea
            id="log-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done, if there is no link or file to show for it"
            className="text-sm"
          />
        </div>

        {/* Links beyond the slots on screen, so a save cannot silently drop them. */}
        {row.links.length > slots.length && (
          <p className="text-muted-foreground text-[11px]">
            {row.links.length - slots.length} more{" "}
            {row.links.length - slots.length === 1 ? "link" : "links"} already saved:{" "}
            {row.links
              .slice(slots.length)
              .map((l) => linkLabel(l))
              .join(", ")}
          </p>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          void onPicked(e.target.files?.[0])
          e.target.value = ""
        }}
      />

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={badLink} loading={m.update.isPending}>
          Save progress
        </Button>
      </DialogFooter>
    </>
  )
}
