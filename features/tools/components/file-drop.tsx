"use client"

import { useEffect, useRef, useState } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fileMatches, formatBytes } from "../lib/files"

interface FileDropProps {
  /** MIME types ("image/png", "image/*") and/or extensions (".heic"). */
  accept: readonly string[]
  onFiles: (files: File[]) => void
  multiple?: boolean
  /** Largest single file, in bytes. */
  maxBytes?: number
  label: string
  hint?: string
  /** Also take images pasted with Ctrl+V while the page is open. */
  allowPaste?: boolean
  className?: string
}

/** Checks type and size before handing files over, and toasts which ones it skipped and why. */
export function FileDrop({
  accept,
  onFiles,
  multiple = false,
  maxBytes,
  label,
  hint,
  allowPaste = false,
  className,
}: FileDropProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  function take(list: File[]) {
    const files = multiple ? list : list.slice(0, 1)
    const ok: File[] = []
    let wrongType = 0
    let tooBig = 0
    for (const f of files) {
      if (!fileMatches(f, accept)) wrongType++
      else if (maxBytes && f.size > maxBytes) tooBig++
      else ok.push(f)
    }
    if (wrongType) toast.error(`${wrongType} file${wrongType > 1 ? "s" : ""} skipped - wrong type`)
    if (tooBig && maxBytes)
      toast.error(`${tooBig} file${tooBig > 1 ? "s" : ""} skipped - over ${formatBytes(maxBytes)}`)
    if (ok.length) onFiles(ok)
  }

  // The latest `take` for the paste listener, synced after render (not during).
  const takeRef = useRef(take)
  useEffect(() => {
    takeRef.current = take
  })

  useEffect(() => {
    if (!allowPaste) return
    const onPaste = (e: ClipboardEvent) => {
      // Leave pasting into text fields alone.
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable=true]")) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) {
        e.preventDefault()
        takeRef.current(files)
      }
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [allowPaste])

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          "text-muted-foreground hover:border-foreground/40 hover:text-foreground flex w-full flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors",
          over && "border-primary bg-primary/5 text-foreground",
          className,
        )}
      >
        <Upload className="h-6 w-6" />
        <span className="text-foreground text-sm font-medium">{label}</span>
        {hint && <span className="text-xs">{hint}</span>}
        {allowPaste && <span className="text-xs">You can also paste an image with Ctrl+V.</span>}
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept.join(",")}
        onChange={(e) => {
          take(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
    </>
  )
}
