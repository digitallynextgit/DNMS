"use client"

import * as React from "react"
import { ImagePlus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Logo control for the project form.
 *
 * Works in both modes, which is the whole reason it holds a File rather than
 * uploading on pick: while CREATING there is no project id to upload against
 * yet, so the chosen file is kept here, previewed from a local object URL, and
 * handed to the parent to POST once the project exists. While EDITING there is
 * an id, so it uploads immediately and the parent does nothing.
 */
export function ProjectLogoPicker({
  projectId,
  value,
  onPendingFileChange,
}: {
  /** Undefined while creating - upload is deferred to the parent. */
  projectId?: string
  /** Current logo URL, if the project already has one. */
  value?: string | null
  /** Create mode only: hands the chosen file up so it can be sent after create. */
  onPendingFileChange?: (file: File | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(value ?? null)
  const [busy, setBusy] = React.useState(false)

  // Revoke the object URL when it is replaced or the component goes away -
  // otherwise every re-pick leaks a blob for the life of the page.
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

    // Create mode: keep it locally, the parent uploads after the project exists.
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
          // Only the empty/loading states get a tile. Once a logo is chosen the
          // preview shows it bare, matching how it renders on the cards.
          !preview && "bg-muted rounded-[2px] border border-dashed",
          busy && "bg-muted rounded-[2px] border",
        )}
      >
        {busy ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : preview ? (
          // Local blob previews and the signed-redirect route both resolve at
          // runtime, so a plain <img> rather than next/image.
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
            size="sm"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? "Replace" : "Upload logo"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-8 text-xs"
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
