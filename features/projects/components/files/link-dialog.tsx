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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DOC_TAGS, DOC_TAG_LABEL, type DocTag } from "../../lib/doc-tag"
import { isSafeHttpUrl } from "../../lib/task-links"

export interface LinkFormValues {
  title: string
  url: string
  tag: DocTag | null
  description: string | null
}

const NO_TAG = "__none"

/** A readable default title from a pasted URL: "figma.com" rather than nothing. */
function titleFromUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

interface LinkFormProps {
  initial?: Partial<LinkFormValues>
  /** Where it will be saved, for the description line; null = top level. */
  folderName?: string | null
  pending?: boolean
  onSubmit: (values: LinkFormValues) => void
  onCancel: () => void
}

/** Add or edit a saved link. `initial.url` pre-fills from a paste/drop. */
export function LinkDialog({
  open,
  onOpenChange,
  ...form
}: Omit<LinkFormProps, "onCancel"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* State lives in a child that only exists while open, so each opening
            starts from `initial` without an effect. */}
        <LinkForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function LinkForm({ initial, folderName, pending = false, onSubmit, onCancel }: LinkFormProps) {
  const isEdit = Boolean(initial?.title)
  const [url, setUrl] = useState(initial?.url ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [tag, setTag] = useState<DocTag | null>(initial?.tag ?? null)
  const [description, setDescription] = useState(initial?.description ?? "")
  const [touched, setTouched] = useState(false)

  const urlOk = isSafeHttpUrl(url.trim())
  const canSubmit = urlOk && title.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!canSubmit || pending) return
        onSubmit({
          url: url.trim(),
          title: title.trim(),
          tag,
          description: description.trim() || null,
        })
      }}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit link" : "Add link"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Change where this link points or what it is called."
            : `A URL saved next to the files${folderName ? ` in "${folderName}"` : ""} - a Figma board, a Notion page, a live site.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label required htmlFor="link-url">
            URL
          </Label>
          <Input
            id="link-url"
            autoFocus={!isEdit}
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              setTouched(true)
              if (!title.trim() && urlOk) setTitle(titleFromUrl(url.trim()))
            }}
          />
          {touched && url.trim() && !urlOk && (
            <p className="text-destructive text-xs">Enter a full http(s) link.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label required htmlFor="link-title">
            Title
          </Label>
          <Input
            id="link-title"
            maxLength={200}
            placeholder="What is this?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="link-tag">Tag</Label>
            <Select
              value={tag ?? NO_TAG}
              onValueChange={(v) => setTag(v === NO_TAG ? null : (v as DocTag))}
            >
              <SelectTrigger id="link-tag">
                <SelectValue placeholder="No tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TAG}>No tag</SelectItem>
                {DOC_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOC_TAG_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="link-description">Description (optional)</Label>
          <Textarea
            id="link-description"
            rows={2}
            maxLength={1000}
            placeholder="Anything the next person should know before opening it"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} loading={pending}>
          {isEdit ? "Save" : "Add link"}
        </Button>
      </DialogFooter>
    </form>
  )
}
