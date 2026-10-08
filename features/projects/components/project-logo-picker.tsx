"use client"

import * as React from "react"
import { ImagePlus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
const MAX_BYTES = 5 * 1024 * 1024

/** Holds the File while creating (the parent uploads it after create); uploads at once when editing. */
export function ProjectLogoPicker({
  projectId,
  value,
  onPendingFileChange,
}: {
  /** Undefined while creating - upload is deferred to the parent. */
  projectId?: string
  value?: string | null
  /** Create mode only: hands the chosen file up so it can be sent after create. */
  onPendingFileChange?: (file: File | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(value ?? null)
  const [busy, setBusy] = React.useState(false)

  // Revoked when replaced or unmounted, so re-picks don't leak blobs.
  const objectUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function setLocalPreview(file: File | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = file ? URL.createObjectURL(file) : null
    setPreview(objectUrlRef.current)
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so re-picking the SAME file still fires a change event.
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_BYTES) {
      toast.error("Logo must be 5 MB or smaller")
      return
    }

    if (!projectId) {
      setLocalPreview(file)
      onPendingFileChange?.(file)
      return
    }

    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`/api/projects/${projectId}/logo`, { method: "POST", body })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Upload failed")
      setPreview(json?.data?.url ?? null)
      toast.success("Logo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the logo")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!projectId) {
      setLocalPreview(null)
      onPendingFileChange?.(null)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/logo`, { method: "DELETE" })
      if (!res.ok) throw new Error("Could not remove the logo")
      setPreview(null)
      toast.success("Logo removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the logo")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden",
          // Only the empty/loading states get a tile; a chosen logo shows bare, as on the cards.
          !preview && "bg-muted rounded-sm border border-dashed",
          busy && "bg-muted rounded-sm border",
        )}
      >
        {busy ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : preview ? (
          // Blob previews and the signed-redirect route resolve at runtime, so a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Project logo" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="text-muted-foreground h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? "Replace" : "Upload logo"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-[11px]">
          PNG, JPG, WEBP or SVG, up to 5 MB.
          {!projectId && " Uploaded once the project is created."}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handlePick}
        className="hidden"
        aria-hidden
      />
    </div>
  )
}
