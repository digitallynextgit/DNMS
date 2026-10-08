"use client"

/* eslint-disable react-hooks/static-components -- false positive: iconFor() returns module-level icons */

/**
 * Send screen after picking files: preview, caption, add or drop, then send. Covers the thread pane,
 * not the viewport. Previews are local object URLs (nothing uploads until Send), revoked on change.
 */

import * as React from "react"
import {
  X,
  Plus,
  SendHorizonal,
  Loader2,
  FileText,
  FileSpreadsheet,
  File,
  Pencil,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmojiPicker } from "@/components/shared/emoji-picker"
import { ImageEditor } from "@/components/shared/image-editor"

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

/** "CSV", "PDF", "DOCX" - the badge under a file with no visual preview. */
function extensionOf(name: string): string {
  const ext = name.split(".").pop()
  return ext && ext !== name ? ext.toUpperCase() : "FILE"
}

function iconFor(file: File) {
  if (/sheet|excel|csv/i.test(file.type) || /\.(csv|xlsx?|ods)$/i.test(file.name))
    return FileSpreadsheet
  if (/pdf|word|document|text/i.test(file.type) || /\.(pdf|docx?|txt|rtf)$/i.test(file.name))
    return FileText
  return File
}

const isImage = (f: File) => f.type.startsWith("image/")
const isVideo = (f: File) => f.type.startsWith("video/")
const isAudio = (f: File) => f.type.startsWith("audio/")

/** Keyed by File and rebuilt only when the list changes, so typing a caption doesn't churn them. */
function useObjectUrls(files: File[]): Map<File, string> {
  const [urls, setUrls] = React.useState<Map<File, string>>(new Map())

  React.useEffect(() => {
    const next = new Map<File, string>()
    for (const f of files) {
      if (isImage(f) || isVideo(f) || isAudio(f)) next.set(f, URL.createObjectURL(f))
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URLs are created and revoked here, so they can't be derived during render
    setUrls(next)
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url)
    }
  }, [files])

  return urls
}

export function AttachmentPreview({
  files,
  onClose,
  onSend,
  sending = false,
  /** Filter for the "+" button, so adding more matches what was picked first. */
  accept,
}: {
  /** Empty = closed. */
  files: File[]
  onClose: () => void
  onSend: (files: File[], caption: string) => Promise<void> | void
  sending?: boolean
  accept?: string
}) {
  const [list, setList] = React.useState<File[]>(files)
  const [active, setActive] = React.useState(0)
  const [caption, setCaption] = React.useState("")
  const addRef = React.useRef<HTMLInputElement>(null)
  /** Index being edited (images only), or null. */
  const [editing, setEditing] = React.useState<number | null>(null)
  const urls = useObjectUrls(list)

  // A fresh pick replaces the contents rather than appending.
  const [prevFiles, setPrevFiles] = React.useState(files)
  if (files !== prevFiles) {
    setPrevFiles(files)
    setList(files)
    setActive(0)
    setCaption("")
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, sending])

  if (list.length === 0) return null

  const current = list[active] ?? list[0]!
  const url = urls.get(current)

  function removeAt(i: number) {
    const next = list.filter((_, n) => n !== i)
    if (next.length === 0) return onClose()
    setList(next)
    setActive((a) => Math.min(a, next.length - 1))
  }

  return (
    <div
      // z-30: above the thread's sticky bits, below dialogs and popovers (z-50).
      className="bg-background absolute inset-0 z-30 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Review attachments before sending"
    >
      {/* Everything below stays mounted so the caption and filmstrip survive editing. */}
      {editing !== null && list[editing] && (
        <ImageEditor
          file={list[editing]!}
          onCancel={() => setEditing(null)}
          onSave={(edited) => {
            setList((l) => l.map((f, i) => (i === editing ? edited : f)))
            setEditing(null)
          }}
        />
      )}

      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cancel"
          disabled={sending}
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">{current.name}</p>
        {isImage(current) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit image"
            title="Crop, filter, draw"
            disabled={sending}
            onClick={() => setEditing(active)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {isImage(current) && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={current.name} className="max-h-full max-w-full object-contain" />
        ) : isVideo(current) && url ? (
          <video src={url} controls className="max-h-full max-w-full object-contain" />
        ) : isAudio(current) && url ? (
          <audio src={url} controls className="w-full max-w-md" />
        ) : (
          <NoPreview file={current} />
        )}
      </div>

      {/* The caption becomes the message body the files hang off. */}
      <div className="shrink-0 px-4 pb-3">
        <div className="border-input bg-card focus-within:ring-ring/50 mx-auto flex max-w-2xl items-center gap-1 rounded-sm border px-2 transition-shadow focus-within:ring-2">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Type a message"
            aria-label="Caption"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void onSend(list, caption.trim())
              }
            }}
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <EmojiPicker
            onPick={(emoji) => setCaption((c) => c + emoji)}
            closeOnPick
            align="end"
            className="h-8 w-8 rounded-sm"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 px-4 pb-4">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto">
          {list.map((f, i) => (
            <div key={`${f.name}-${i}`} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={f.name}
                aria-pressed={i === active}
                className={cn(
                  "bg-card flex h-12 w-12 items-center justify-center overflow-hidden rounded-sm border-2 transition-colors",
                  i === active ? "border-primary" : "hover:border-border border-transparent",
                )}
              >
                <Thumb file={f} url={urls.get(f)} />
              </button>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                disabled={sending}
                onClick={() => removeAt(i)}
                className="bg-background text-muted-foreground hover:text-destructive absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-sm border opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addRef.current?.click()}
            aria-label="Add more files"
            disabled={sending}
            className="border-border hover:bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
          <input
            ref={addRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setList((l) => [...l, ...picked])
              e.target.value = ""
            }}
          />
        </div>

        <Button
          size="icon"
          aria-label="Send"
          disabled={sending}
          onClick={() => void onSend(list, caption.trim())}
          className="shrink-0 rounded-sm"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizonal className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function NoPreview({ file }: { file: File }) {
  const Icon = iconFor(file)
  return (
    <div className="bg-card flex w-full max-w-sm flex-col items-center gap-3 rounded-sm px-6 py-12">
      <Icon className="text-muted-foreground h-14 w-14" />
      <p className="text-base font-medium">No preview available</p>
      <p className="text-muted-foreground text-sm">
        {humanSize(file.size)} · {extensionOf(file.name)}
      </p>
    </div>
  )
}

function Thumb({ file, url }: { file: File; url?: string }) {
  if (isImage(file) && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />
  }
  if (isVideo(file) && url) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }
  const Icon = iconFor(file)
  return <Icon className="text-muted-foreground h-5 w-5" />
}
